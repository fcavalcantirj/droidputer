// Phone keys for apps that scan the ORIGINAL Cardputer's GPIO keyboard matrix themselves instead of going through
// M5Cardputer (ESP32Marauder's Keyboard.cpp: rows on G8/G9/G11 through a 74HC138, columns read on G13/G15/G3..G7).
// Force-included (-include) by the overlay recipe of such an app, in the bare-S3 env only: every gpio_get_level()
// call goes through dp_gpio_get_level(), which answers the 7 column pins from the keys held on the phone for the row
// the app selected and passes every other pin straight to the real GPIO. The app's source stays untouched.
#pragma once
#define gpio_get_level(pin) dp_gpio_get_level(pin)
