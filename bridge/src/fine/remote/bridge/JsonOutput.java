package fine.remote.bridge;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.lang.reflect.Array;
import java.util.LinkedHashMap;
import java.util.Map;

final class JsonOutput {
  private JsonOutput() {
  }

  static String success(String operation, Map<String, Object> payload) {
    Map<String, Object> data = new LinkedHashMap<>();
    data.put("status", "ok");
    data.put("operation", operation);
    data.putAll(payload);
    return stringify(data);
  }

  static String error(String operation, String message) {
    Map<String, Object> data = new LinkedHashMap<>();
    data.put("status", "error");
    data.put("operation", operation);
    data.put("message", message);
    return stringify(data);
  }

  static String error(String operation, Exception exception) {
    Map<String, Object> data = new LinkedHashMap<>();
    data.put("status", "error");
    data.put("operation", operation);
    data.put("message", safeMessage(exception));
    data.put("exception", exception.getClass().getName());
    data.put("detail", stackTrace(exception));
    return stringify(data);
  }

  private static String stackTrace(Exception exception) {
    StringWriter writer = new StringWriter();
    exception.printStackTrace(new PrintWriter(writer));
    return writer.toString();
  }

  private static String safeMessage(Exception exception) {
    String message = exception.getMessage();
    return message == null || message.isEmpty() ? exception.getClass().getName() : message;
  }

  private static String stringify(Object value) {
    if (value == null) {
      return "null";
    }
    if (value instanceof String text) {
      return quote(text);
    }
    if (value instanceof Number || value instanceof Boolean) {
      return value.toString();
    }
    if (value instanceof Map<?, ?> map) {
      return mapToJson(map);
    }
    if (value instanceof Iterable<?> iterable) {
      return iterableToJson(iterable);
    }
    if (value.getClass().isArray()) {
      return arrayToJson(value);
    }
    return quote(value.toString());
  }

  private static String mapToJson(Map<?, ?> map) {
    StringBuilder builder = new StringBuilder("{");
    int index = 0;
    for (Map.Entry<?, ?> entry : map.entrySet()) {
      if (index > 0) {
        builder.append(',');
      }
      builder.append(quote(String.valueOf(entry.getKey())));
      builder.append(':');
      builder.append(stringify(entry.getValue()));
      index += 1;
    }
    return builder.append('}').toString();
  }

  private static String iterableToJson(Iterable<?> values) {
    StringBuilder builder = new StringBuilder("[");
    int index = 0;
    for (Object value : values) {
      if (index > 0) {
        builder.append(',');
      }
      builder.append(stringify(value));
      index += 1;
    }
    return builder.append(']').toString();
  }

  private static String arrayToJson(Object values) {
    StringBuilder builder = new StringBuilder("[");
    int length = Array.getLength(values);
    for (int index = 0; index < length; index += 1) {
      if (index > 0) {
        builder.append(',');
      }
      builder.append(stringify(Array.get(values, index)));
    }
    return builder.append(']').toString();
  }

  private static String quote(String value) {
    String escaped = value
        .replace("\\", "\\\\")
        .replace("\"", "\\\"")
        .replace("\n", "\\n")
        .replace("\r", "\\r")
        .replace("\t", "\\t");
    return "\"" + escaped + "\"";
  }
}
