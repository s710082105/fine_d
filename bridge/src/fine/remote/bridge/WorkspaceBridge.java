package fine.remote.bridge;

import java.net.URLClassLoader;

final class WorkspaceBridge {
  private static final String CONNECTOR_CLASS = "com.fr.workspace.engine.client.FineWorkspaceConnector";
  private static final String CONNECTION_INFO_CLASS = "com.fr.workspace.connect.WorkspaceConnectionInfo";
  private static final String FILE_NODES_CLASS = "com.fr.file.filetree.FileNodes";
  private static final String WORK_RESOURCE_CLASS = "com.fr.workspace.resource.WorkResource";

  private WorkspaceBridge() {
  }

  static BridgeContext connect(RequestData request) throws Exception {
    URLClassLoader loader = FineLoader.create(request.fineHome());
    try {
      Thread.currentThread().setContextClassLoader(loader);
      initialize(loader);
      Class<?> connectorClass = loader.loadClass(CONNECTOR_CLASS);
      Object connector = ReflectionSupport.invokeStatic(connectorClass, "getInstance");
      Class<?> connectionInfoClass = loader.loadClass(CONNECTION_INFO_CLASS);
      Object info = connectionInfo(request, connectionInfoClass);
      Object client = ReflectionSupport.invoke(
          connector,
          "connect",
          new Class<?>[]{connectionInfoClass},
          info
      );
      Object pool = ReflectionSupport.invoke(client, "getPool");
      Object fileNodes = ReflectionSupport.invoke(
          pool,
          "get",
          new Class<?>[]{Class.class},
          loader.loadClass(FILE_NODES_CLASS)
      );
      Object workResource = ReflectionSupport.invoke(
          pool,
          "get",
          new Class<?>[]{Class.class},
          loader.loadClass(WORK_RESOURCE_CLASS)
      );
      return new BridgeContext(loader, client, fileNodes, workResource);
    } catch (Exception exception) {
      try {
        loader.close();
      } catch (Exception ignored) {
      }
      throw exception;
    }
  }

  private static Object connectionInfo(RequestData request, Class<?> type) throws Exception {
    return ReflectionSupport.newInstance(
        type,
        new Class<?>[]{
            String.class,
            String.class,
            String.class,
            String.class,
            String.class,
            Boolean.TYPE
        },
        request.baseUrl(),
        request.username(),
        request.password(),
        "",
        "",
        Boolean.FALSE
    );
  }

  private static void initialize(URLClassLoader loader) throws Exception {
    Class<?> serializerClass = loader.loadClass("com.fr.serialization.SerializerSummary");
    Object serializer = ReflectionSupport.invokeStatic(serializerClass, "getDefault");
    ReflectionSupport.invoke(serializer, "complete");

    Class<?> generalUtilsClass = loader.loadClass("com.fr.general.GeneralUtils");
    String buildNo = String.valueOf(ReflectionSupport.invokeStatic(generalUtilsClass, "readBuildNO"));
    Class<?> workContextClass = loader.loadClass("com.fr.workspace.WorkContext");
    ReflectionSupport.invokeStatic(
        workContextClass,
        "setVersion",
        new Class<?>[]{String.class},
        buildNo
    );
  }
}
