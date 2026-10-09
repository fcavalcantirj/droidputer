package com.droidputter.telemetry

import android.content.Context
import android.util.Log
import com.droidputter.BuildConfig
import com.posthog.PersonProfiles
import com.posthog.PostHog
import com.posthog.android.PostHogAndroid
import com.posthog.android.PostHogAndroidConfig
import java.io.File

/**
 * Anonymous usage + crash reports (Felipe, 2026-10-09: "how people are using it"), sent to hosted PostHog Cloud
 * (free tier; nothing self-hosted). OPT-IN: nothing is initialised, let alone sent, until the user says yes once;
 * the Connection screen turns it off again. Every event carries `device` = the same anonymous per-install id the
 * public verdicts use (VerdictRepository.reporter), so app events, verdicts and the proxy's build events line up
 * without person profiles. Never: location, IP-derived data on our side, account ids, keystrokes, screen pixels.
 */
object Telemetry {
    private const val TAG = "Droidputter"
    private const val CONSENT_FILE = "analytics_consent"

    /** null = never asked (show the dialog), true / false = the user's answer. */
    @Volatile var consent: Boolean? = null
        private set

    @Volatile private var started = false
    private var device = ""

    /** Once per process, from MainActivity.onCreate: read the stored answer and start if it was yes. */
    fun init(context: Context, deviceId: String) {
        device = deviceId
        consent = runCatching { File(context.filesDir, CONSENT_FILE).takeIf { it.isFile }?.readText()?.trim() }
            .getOrNull()?.let { it == "1" }
        if (consent == true) start(context.applicationContext)
    }

    /** The first-launch dialog or the Connection screen toggle. */
    fun answer(context: Context, yes: Boolean) {
        consent = yes
        runCatching { File(context.filesDir, CONSENT_FILE).writeText(if (yes) "1" else "0") }
            .onFailure { Log.w(TAG, "analytics consent not saved: ${it.message}") }
        if (yes) {
            if (started) PostHog.optIn() else start(context.applicationContext)
            capture("analytics_opt_in")
        } else if (started) {
            PostHog.optOut()
        }
    }

    private fun start(app: Context) {
        val key = BuildConfig.POSTHOG_KEY
        if (started || key.isBlank() || key == "off") return
        runCatching {
            val config = PostHogAndroidConfig(key, BuildConfig.POSTHOG_HOST).apply {
                captureApplicationLifecycleEvents = true   // Application Opened / Backgrounded / Installed / Updated
                captureScreenViews = false                  // one Activity; screens are Compose state, sent as events
                captureDeepLinks = false
                sessionReplay = false
                personProfiles = PersonProfiles.NEVER
                // Off on purpose: the SDK's own crash handler obeys the PROJECT setting "exception autocapture", which
                // PostHog ships disabled (remote config autocaptureExceptions=false, measured 2026-10-09), so crashes were
                // silently dropped. installCrashHandler() below does what that handler does, unconditionally.
                errorTrackingConfig.autoCapture = false
                debug = BuildConfig.DEBUG                   // logcat tag PostHog: what is queued and sent (debug builds only)
            }
            PostHogAndroid.setup(app, config)
            PostHog.register("device", device)
            installCrashHandler()
            started = true
        }.onFailure { Log.w(TAG, "analytics not started: ${it.message}") }
    }

    /**
     * Uncaught exception -> `$exception` (the SDK's own path: captureException, flush, then the previous handler so
     * Android still shows its crash dialog and kills the process). Respects a later opt-out: no capture without consent.
     */
    private fun installCrashHandler() {
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, error ->
            if (consent == true) {
                runCatching {
                    PostHog.captureException(error, mapOf("thread" to thread.name, "fatal" to true))
                    PostHog.flush()
                }
            }
            previous?.uncaughtException(thread, error)
        }
    }

    /** One event, only when the user said yes. Null values are dropped; never throws into the caller. */
    fun capture(event: String, props: Map<String, Any?> = emptyMap()) {
        if (!started || consent != true) return
        runCatching {
            @Suppress("UNCHECKED_CAST")
            PostHog.capture(event = event, properties = props.filterValues { it != null } as Map<String, Any>)
        }.onFailure { Log.w(TAG, "analytics capture failed: ${it.message}") }
    }

    /** A caught exception worth seeing (flash/link failures surface as status lines, not crashes). */
    fun exception(t: Throwable, props: Map<String, Any?> = emptyMap()) {
        if (!started || consent != true) return
        @Suppress("UNCHECKED_CAST")
        runCatching { PostHog.captureException(t, props.filterValues { it != null } as Map<String, Any>) }
    }
}
