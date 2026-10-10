plugins {
    id("com.android.application")
    kotlin("android")
    id("org.jetbrains.kotlin.plugin.compose")
}

// Demo mode (no USB) replays fixtures/pense-bem/boot.{bin,jsonl} through FixtureTransport;
// bundle it as an asset from the repo's tracked copy instead of committing a second one under
// android/ (the repo .gitignore blankets *.bin except fixtures/**/*.bin).
val demoFixtureSrc = rootProject.projectDir.parentFile.resolve("fixtures/pense-bem")

/**
 * Copies a fixed set of repo files into `<outputDir>/<into>/` for the APK's assets. A typed task with a
 * DirectoryProperty output, wired through the AGP variant API below (`addGeneratedSourceDirectory`), so the
 * dependency is explicit. The previous `assets.srcDir(copyTask.map { it.destinationDir })` created none:
 * the copy tasks never ran and v0.0.1..v0.0.6 shipped WITHOUT assets -- "Replay fixture" crashed with
 * FileNotFoundException for 10 Play users (2026-10-09) and the catalog/verdicts offline seed was missing.
 */
abstract class CopyAssetFiles : DefaultTask() {
    @get:InputFiles
    @get:PathSensitive(PathSensitivity.NAME_ONLY)
    abstract val sources: ConfigurableFileCollection

    @get:Input
    abstract val into: Property<String>

    @get:OutputDirectory
    abstract val outputDir: DirectoryProperty

    @TaskAction
    fun copy() {
        val root = outputDir.get().asFile
        root.deleteRecursively()   // exactly these files, nothing stale (bins once bundled before 2026-09-04)
        val dest = root.resolve(into.get()).apply { mkdirs() }
        sources.files.forEach { f ->
            check(f.isFile) { "asset source missing: $f" }
            f.copyTo(dest.resolve(f.name), overwrite = true)
        }
    }
}

val demoFixtureAssets = tasks.register<CopyAssetFiles>("demoFixtureAssets") {
    sources.from(demoFixtureSrc.resolve("boot.bin"), demoFixtureSrc.resolve("boot.jsonl"))
    into.set("fixtures/pense-bem")
}

// Catalog screen: bundles apps/catalog.json (+ apps/verdicts.json) only as the offline SEED of the
// live index the app fetches from GitHub at run time (CatalogRepository / VerdictRepository). No
// firmware binaries ship in the APK (Felipe, 2026-09-03: "hold data only; download at flash time") --
// BinStore downloads each part by its catalog url when the user flashes or shares, into a
// sha256-verified cache under filesDir/bins.
val catalogJsonSrc = rootProject.projectDir.parentFile.resolve("apps/catalog.json")
val verdictsJsonSrc = rootProject.projectDir.parentFile.resolve("apps/verdicts.json")

val catalogSeedAssets = tasks.register<CopyAssetFiles>("catalogSeedAssets") {
    sources.from(catalogJsonSrc)
    if (verdictsJsonSrc.isFile) sources.from(verdictsJsonSrc)
    into.set("catalog")
}

// Release signing inputs (release.yml on a v* tag). All four come from the environment; none set = local dev build
// with the debug key, exactly as before. A keystore path without the other three is a misconfiguration, not a
// silent fallback, so it fails here rather than shipping a debug-signed "release".
val releaseKeystore = System.getenv("RELEASE_KEYSTORE")?.takeIf { it.isNotBlank() }?.let { File(it) }?.takeIf { it.isFile }
val releaseSigningVars = listOf("RELEASE_KEYSTORE_PASSWORD", "RELEASE_KEY_ALIAS", "RELEASE_KEY_PASSWORD")
val releaseSigningReady = releaseKeystore != null && releaseSigningVars.all { !System.getenv(it).isNullOrEmpty() }
if (releaseKeystore != null && !releaseSigningReady) {
    error("RELEASE_KEYSTORE is set but ${releaseSigningVars.filter { System.getenv(it).isNullOrEmpty() }} missing")
}

android {
    namespace = "com.droidputter"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.droidputter"
        manifestPlaceholders["appLabel"] = "Droidputer"
        buildConfigField("boolean", "SHARE_VERDICTS", "true")
        minSdk = 26
        targetSdk = 36
        // release.yml derives both from the tag (vMAJOR.MINOR.PATCH -> code MAJOR*10000 + MINOR*100 + PATCH);
        // local and android.yml builds keep these defaults.
        versionCode = (project.findProperty("versionCode") as String?)?.toIntOrNull() ?: 1
        versionName = (project.findProperty("versionName") as String?) ?: "0.0.1"
        // Build proxy origin override for LAN spikes: `./gradlew assembleDebug -PproxyBaseUrl=http://<mac>:8787`.
        // Empty = the app's default (BuildProxy.DEFAULT_BASE_URL, the deployed proxy).
        buildConfigField("String", "PROXY_BASE_URL", "\"${project.findProperty("proxyBaseUrl") ?: ""}\"")
        // USB reader buffer for A/B runs: `-PusbReadBuffer=0` keeps the library default (the endpoint's 64 B max
        // packet, one USB request per packet); the default here is the 16 KB measured on stellar-map 2026-09-05.
        buildConfigField("int", "USB_READ_BUFFER", "${project.findProperty("usbReadBuffer") ?: "16384"}")
        // PostHog project token (public by design: it can only SEND events). -PposthogKey= overrides it, -PposthogKey=off
        // builds an app that never initialises analytics. Nothing is sent before the user opts in (Telemetry.kt).
        buildConfigField("String", "POSTHOG_KEY", "\"${project.findProperty("posthogKey") ?: "phc_yLh8FABHN8WdBR4JxmSRhFS5qUMFcAuHt335g6ZF8RWJ"}\"")
        buildConfigField("String", "POSTHOG_HOST", "\"${project.findProperty("posthogHost") ?: "https://us.i.posthog.com"}\"")
    }

    signingConfigs {
        // Populated only when the four RELEASE_* env vars exist; otherwise an empty config nothing references.
        create("release") {
            if (releaseSigningReady) {
                storeFile = releaseKeystore
                storePassword = System.getenv("RELEASE_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("RELEASE_KEY_ALIAS")
                keyPassword = System.getenv("RELEASE_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        // A debug build installs BESIDE the Play app (com.droidputter.dev, its own label): phone tests of an app change
        // without touching the user's install, consent or builds. Release keeps com.droidputter.
        debug {
            applicationIdSuffix = ".dev"
            manifestPlaceholders["appLabel"] = "Droidputer dev"
            // A dev build never feeds the public stats (a consented dev install = one more phone, its test flashes = burns);
            // -PposthogKey=<token> still turns it on for telemetry work.
            buildConfigField("String", "POSTHOG_KEY", "\"${project.findProperty("posthogKey") ?: "off"}\"")
            buildConfigField("boolean", "SHARE_VERDICTS", "false")   // test flashes never file public verdicts
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            // Release key when RELEASE_KEYSTORE points at an existing .jks: CI (release.yml) decodes it from the
            // RELEASE_KEYSTORE_B64 secret into a temp file. Otherwise the debug key, so local/android.yml builds are
            // unchanged. Losing that keystore means no in-place updates for installed users (uninstall + reinstall).
            signingConfig = signingConfigs.getByName(if (releaseSigningReady) "release" else "debug")
        }
        // Release code (R8, release timing) beside the Play app: `assembleDev` reproduced the flasher race the debug
        // build never hit (2026-10-10). Debug-signed, no analytics, no public verdicts.
        create("dev") {
            initWith(getByName("release"))
            applicationIdSuffix = ".dev"
            manifestPlaceholders["appLabel"] = "Droidputer dev"
            signingConfig = signingConfigs.getByName("debug")
            buildConfigField("String", "POSTHOG_KEY", "\"${project.findProperty("posthogKey") ?: "off"}\"")
            buildConfigField("boolean", "SHARE_VERDICTS", "false")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
}

androidComponents {
    onVariants { variant ->
        variant.sources.assets?.addGeneratedSourceDirectory(demoFixtureAssets, CopyAssetFiles::outputDir)
        variant.sources.assets?.addGeneratedSourceDirectory(catalogSeedAssets, CopyAssetFiles::outputDir)
    }
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation(project(":core"))

    val composeBom = platform("androidx.compose:compose-bom:2024.10.01")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.activity:activity-compose:1.9.3")
    debugImplementation("androidx.compose.ui:ui-tooling")

    implementation("com.github.mik3y:usb-serial-for-android:3.8.0")
    implementation("androidx.core:core-ktx:1.13.1")
    // Usage + crash analytics (hosted PostHog Cloud, free tier; opt-in, see Telemetry.kt). 3.71.1 = 2026-09-25.
    implementation("com.posthog:posthog-android:3.71.1")
}
