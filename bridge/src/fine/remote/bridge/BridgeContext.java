package fine.remote.bridge;

import java.io.Closeable;
import java.net.URLClassLoader;

final class BridgeContext implements Closeable {
  private final URLClassLoader loader;
  private final Object client;
  private final Object fileNodes;
  private final Object workResource;

  BridgeContext(URLClassLoader loader, Object client, Object fileNodes, Object workResource) {
    this.loader = loader;
    this.client = client;
    this.fileNodes = fileNodes;
    this.workResource = workResource;
  }

  Object fileNodes() {
    return fileNodes;
  }

  Object workResource() {
    return workResource;
  }

  @Override
  public void close() {
    try {
      ReflectionSupport.invoke(client, "close");
    } catch (Exception ignored) {
    }
    try {
      loader.close();
    } catch (Exception ignored) {
    }
  }
}
