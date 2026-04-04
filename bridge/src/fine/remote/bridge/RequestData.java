package fine.remote.bridge;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

final class RequestData {
  private final String operation;
  private final Map<String, String> values;

  private RequestData(String operation, Map<String, String> values) {
    this.operation = operation;
    this.values = values;
  }

  static RequestData fromStdIn(String operation) throws Exception {
    return new RequestData(operation, parseEncodedContent(readInput()));
  }

  static boolean isSupportedOperation(String operation) {
    return "list".equals(operation)
        || "read".equals(operation)
        || "write".equals(operation)
        || "delete".equals(operation)
        || "encrypt".equals(operation)
        || "encrypt-transmission".equals(operation);
  }

  String operation() {
    return operation;
  }

  String fineHome() {
    return require("fineHome");
  }

  String baseUrl() {
    return require("baseUrl");
  }

  String username() {
    return require("username");
  }

  String password() {
    return require("password");
  }

  String path() {
    return require("path");
  }

  String text() {
    return require("text");
  }

  String transmissionEncryption() {
    return require("transmissionEncryption");
  }

  String frontSeed() {
    return require("frontSeed");
  }

  String frontSm4Key() {
    return require("frontSm4Key");
  }

  byte[] inputBytes() {
    return Base64.getDecoder().decode(require("inputBase64"));
  }

  private String require(String key) {
    String value = values.get(key);
    if (value == null || value.isEmpty()) {
      throw new IllegalArgumentException("missing request field: " + key);
    }
    return value;
  }

  private static String readInput() throws Exception {
    ByteArrayOutputStream buffer = new ByteArrayOutputStream();
    byte[] chunk = new byte[4096];
    int count;
    while ((count = System.in.read(chunk)) != -1) {
      buffer.write(chunk, 0, count);
    }
    return new String(buffer.toByteArray(), StandardCharsets.UTF_8);
  }

  static Map<String, String> parseEncodedContent(String content) {
    Map<String, String> result = new HashMap<>();
    for (String line : content.split("\\r?\\n")) {
      if (line.isEmpty()) {
        continue;
      }
      int separator = line.indexOf('=');
      if (separator <= 0) {
        throw new IllegalArgumentException("invalid request line: " + line);
      }
      String key = line.substring(0, separator);
      String encoded = line.substring(separator + 1);
      byte[] decoded = Base64.getDecoder().decode(encoded);
      result.put(key, new String(decoded, StandardCharsets.UTF_8));
    }
    return result;
  }
}
