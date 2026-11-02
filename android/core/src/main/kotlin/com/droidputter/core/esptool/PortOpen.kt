package com.droidputter.core.esptool

/** What one attempt at opening the USB port found. */
sealed interface PortProbe<out P> {
    data class Ready<P>(val port: P) : PortProbe<P>
    data object NoDevice : PortProbe<Nothing>
    data object NoPermission : PortProbe<Nothing>
    data class Busy(val cause: String) : PortProbe<Nothing>
}

/**
 * Opens the port, retrying what can clear by itself: a port still closing after the link stood down, or a device
 * still enumerating. Permission is not retried: only the user can grant it. [now] and [sleep] are injected for tests.
 */
fun <P> openWithRetry(
    noDeviceMs: Long = 2_000,
    busyMs: Long = 5_000,
    stepMs: Long = 250,
    now: () -> Long = System::currentTimeMillis,
    sleep: (Long) -> Unit = Thread::sleep,
    probe: () -> PortProbe<P>,
): PortProbe<P> {
    val start = now()
    while (true) {
        val result = probe()
        val budget = when (result) {
            is PortProbe.Ready, PortProbe.NoPermission -> return result
            PortProbe.NoDevice -> noDeviceMs
            is PortProbe.Busy -> busyMs
        }
        if (now() - start >= budget) return result
        sleep(stepMs)
    }
}

/** The user-facing failure for a probe that never became ready. */
fun portFailure(probe: PortProbe<*>): EspFlashException = when (probe) {
    is PortProbe.Ready -> EspFlashException("the USB port is ready")
    PortProbe.NoDevice -> EspFlashException(
        "No board found on USB. Plug in an ESP32-S3 with a data cable. If it still does not appear, check that OTG is on in your phone's settings.",
        kind = "no_board",
    )
    PortProbe.NoPermission -> EspFlashException("Android has not allowed USB access. Tap Allow when it asks, then try again.", kind = "no_permission")
    is PortProbe.Busy -> EspFlashException("The USB port is busy: ${probe.cause}", kind = "port_busy")
}
