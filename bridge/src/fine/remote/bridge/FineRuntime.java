package fine.remote.bridge;

import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class FineRuntime {
  private final RequestData request;

  FineRuntime(RequestData request) {
    this.request = request;
  }

  String execute() throws Exception {
    System.setProperty("user.dir", request.fineHome());
    String operation = request.operation();
    if ("encrypt".equals(operation)) {
      return JsonOutput.success(operation, TransmissionBridge.encrypt(request));
    }
    if ("encrypt-transmission".equals(operation)) {
      return JsonOutput.success(operation, TransmissionBridge.encryptTransmission(request));
    }
    try (BridgeContext context = WorkspaceBridge.connect(request)) {
      return JsonOutput.success(operation, workspacePayload(context, operation));
    }
  }

  private Map<String, Object> workspacePayload(BridgeContext context, String operation) throws Exception {
    if ("list".equals(operation)) {
      return listPayload(context);
    }
    if ("read".equals(operation)) {
      return readPayload(context);
    }
    if ("write".equals(operation)) {
      return writePayload(context);
    }
    return deletePayload(context);
  }

  private Map<String, Object> listPayload(BridgeContext context) throws Exception {
    Object[] nodes = (Object[]) ReflectionSupport.invoke(
        context.fileNodes(),
        "list",
        new Class<?>[]{String.class},
        request.path()
    );
    List<Map<String, Object>> items = new ArrayList<>();
    if (nodes != null) {
      for (Object node : nodes) {
        items.add(nodePayload(node));
      }
    }
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("items", items);
    return payload;
  }

  private Map<String, Object> readPayload(BridgeContext context) throws Exception {
    byte[] content = (byte[]) ReflectionSupport.invoke(
        context.workResource(),
        "readFully",
        new Class<?>[]{String.class},
        request.path()
    );
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("contentBase64", Base64.getEncoder().encodeToString(content));
    payload.put("size", Integer.valueOf(content.length));
    return payload;
  }

  private Map<String, Object> writePayload(BridgeContext context) throws Exception {
    ensureParentDirectories(context, request.path());
    byte[] content = request.inputBytes();
    ReflectionSupport.invoke(
        context.workResource(),
        "save",
        new Class<?>[]{String.class, String.class, byte[].class},
        request.path() + ".codex.tmp",
        request.path(),
        content
    );
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("path", request.path());
    payload.put("size", Integer.valueOf(content.length));
    return payload;
  }

  private Map<String, Object> deletePayload(BridgeContext context) throws Exception {
    Boolean deleted = (Boolean) ReflectionSupport.invoke(
        context.workResource(),
        "delete",
        new Class<?>[]{String.class},
        request.path()
    );
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("path", request.path());
    payload.put("deleted", deleted);
    return payload;
  }

  private Map<String, Object> nodePayload(Object node) throws Exception {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("name", ReflectionSupport.invokeString(node, "getName"));
    payload.put("path", normalizePath(ReflectionSupport.invokeString(node, "getEnvPath")));
    payload.put("directory", Boolean.valueOf(ReflectionSupport.invokeBoolean(node, "isDirectory")));
    payload.put("lock", ReflectionSupport.invokeString(node, "getLock"));
    return payload;
  }

  private void ensureParentDirectories(BridgeContext context, String path) throws Exception {
    String[] parts = path.split("/");
    StringBuilder current = new StringBuilder(parts[0]);
    for (int index = 1; index < parts.length - 1; index += 1) {
      current.append('/').append(parts[index]);
      String directory = current.toString();
      Boolean exists = (Boolean) ReflectionSupport.invoke(
          context.workResource(),
          "exist",
          new Class<?>[]{String.class},
          directory
      );
      if (!exists.booleanValue()) {
        ReflectionSupport.invoke(
            context.workResource(),
            "createDirectory",
            new Class<?>[]{String.class},
            directory
        );
      }
    }
  }

  private String normalizePath(String path) {
    if (path == null) {
      return null;
    }
    String normalized = path.replace('\\', '/');
    while (normalized.startsWith("/")) {
      normalized = normalized.substring(1);
    }
    return normalized;
  }
}
