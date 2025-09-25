# Embeddable web framework template
Preact template made for targetting embedded devices like esp32, esp8266 or rpi pico w.
It is made to automatically generate C header that can then be served by the device, while keeping the total stored size minimum.
Preact is compatible with most of react libraries and ecosystem, so
you can use most of stuff you are familiar with.

This framework is made for ease of use, so It contains a custom filesystem router,
where directories under src/pages are route names, page.tsx is a page component, and layout.tsx is stacked for everything below It.
There is also support for css modules and image imports.
All this, while still supporting dev, build, and serve commands for easy development.

This template contains simple `counter` example under `/counter` path.
Thanks to preact, overhead is really small, making total bundle size of this minimal example just 6.22kB (can be 5.43 with brotli, but it is unsupported by some browsers).
By default `bundlePreact` option is disabled, aliasing preact to its CDN version, making total bundle size 1.19kB for the same example.
This is preferred way of using this framework, but if you're making some kind of captive page, It might be necessary to provide everything locally.

### Usage
Remember to add `Content-Encoding: gzip` to all your server responses.

```c
#ifdef ESP32
    #include <WebServer.h>
    #include <WiFi.h>
#elif defined(ESP8266)
    #include <ESP8266WebServer.h>
    #include <ESP8266WiFi.h>
#endif
#include "static_site.h"

#ifdef ESP32
  WebServer server(80)
#elif defined(ESP8266)
  ESP8266WebServer server(80);
#endif

const char *ssid = "YOUR SSID";
const char *password = "YOUR PASSWORD";

void setup() {
  WiFi.begin(ssid, password);
  Serial.begin(115200);
  delay(100);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.print("\nConnected to: ");
  Serial.println(ssid);
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());

  // Define the default entrypoints.
  for (const auto& route : static_site::routes) {
    server.on(route.path, [route] {
      server.sendHeader("Content-Encoding", "gzip");
      server.send_P(
        200, 
        "text/html", 
        (const char*) route.data, 
        route.size
      );
    });
  }

  // Define js chunks and other junk.
  for (const auto& resource : static_site::resources) {
    server.on(resource.path, [resource] {
      server.sendHeader("Content-Encoding", "gzip");
      server.send_P(
        200, 
        resource.mime, 
        (const char*) resource.data, 
        resource.size
      );
    });
  }
  server.begin();
}

void loop() {
  server.handleClient();
}
```