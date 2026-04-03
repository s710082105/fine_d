package fine.remote.bridge;

import java.io.File;
import java.net.URL;
import java.net.URLClassLoader;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

final class FineLoader {
  private static final String[] JAR_DIRECTORIES = {
      "lib",
      "server/lib",
      "webapps/webroot/WEB-INF/lib"
  };

  private FineLoader() {
  }

  static URLClassLoader create(String fineHome) throws Exception {
    List<URL> urls = new ArrayList<>();
    for (File file : collectJarFiles(fineHome)) {
      urls.add(file.toURI().toURL());
    }
    return new URLClassLoader(urls.toArray(new URL[0]), Main.class.getClassLoader());
  }

  private static List<File> collectJarFiles(String fineHome) {
    File root = new File(fineHome);
    List<File> jars = new ArrayList<>();
    for (String directory : JAR_DIRECTORIES) {
      addJarDirectory(jars, new File(root, directory));
    }
    if (jars.isEmpty()) {
      throw new IllegalArgumentException("no FineReport jars found under " + root.getAbsolutePath());
    }
    return jars;
  }

  private static void addJarDirectory(List<File> jars, File directory) {
    if (!directory.isDirectory()) {
      return;
    }
    File[] files = directory.listFiles();
    if (files == null) {
      return;
    }
    Arrays.sort(files);
    for (File file : files) {
      if (file.getName().endsWith(".jar")) {
        jars.add(file);
      }
    }
  }
}
