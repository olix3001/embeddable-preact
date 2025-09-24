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
Thanks to preact, overhead is really small, making total bundle size of this minimal example just 5.43kB.

### Usage
Remember to add `Content-Encoding: br` to all your server responses.

```c
#include <WiFi.h>
#ifdef ESP32
    #include <WebServer.h>
#elif defined(ESP8266)
    #include <ESP8266WebServer.h>
#endif
#include "static_site.h"

WebServer server(80);

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
  for (int i = 0; i < static_site::num_routes; i++) {
    server.on(static_site::routes[i].path, [] {
      server.sendHeader("Content-Encoding", "br");
      server.send_P(
        200, 
        "text/html", 
        (const char *)static_site::routes[i].data, 
        static_site::routes[i].size
      );
    });
  }

  // Define js chunks and other junk.
  for (int i = 0; i < static_site::num_resources; i++) {
    server.on(static_site::resources[i].path, [i] {
      server.sendHeader("Content-Encoding", "br");
      server.send_P(
        200, 
        static_site::resources[i].type, 
        (const char *)static_site::resources[i].contents, 
        static_site::resources[i].size
      );
    });
  }
  server.begin();
}

void loop() {
  server.handleClient();
}
```