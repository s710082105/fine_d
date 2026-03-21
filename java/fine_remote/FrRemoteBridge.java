package fine_remote;

import com.fr.file.filetree.FileNode;
import com.fr.file.filetree.FileNodes;
import com.fr.general.GeneralUtils;
import com.fr.serialization.SerializerSummary;
import com.fr.workspace.WorkContext;
import com.fr.workspace.connect.WorkspaceClient;
import com.fr.workspace.connect.WorkspaceConnectionInfo;
import com.fr.workspace.engine.client.FineWorkspaceConnector;
import com.fr.workspace.resource.WorkResource;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

public final class FrRemoteBridge {
  private FrRemoteBridge() {
  }

  public static void main(String[] args) throws Exception {
    Arguments arguments = Arguments.parse(args);
    initializeWorkspaceClient();

    WorkspaceClient client = connect(arguments);
    try {
      String json = execute(client, arguments);
      Files.write(Paths.get(arguments.outputFile), json.getBytes(StandardCharsets.UTF_8));
    } finally {
      client.close();
    }
  }

  private static void initializeWorkspaceClient() {
    SerializerSummary.getDefault().complete();
    WorkContext.setVersion(GeneralUtils.readBuildNO());
  }

  private static WorkspaceClient connect(Arguments arguments) throws Exception {
    WorkspaceConnectionInfo info = new WorkspaceConnectionInfo(
        arguments.url,
        arguments.username,
        arguments.password,
        null,
        null,
        false
    );
    return FineWorkspaceConnector.getInstance().connect(info);
  }

  private static String execute(WorkspaceClient client, Arguments arguments) throws Exception {
    if ("list".equals(arguments.command)) {
      return listFiles(client, arguments.path);
    }
    if ("read".equals(arguments.command)) {
      return readFile(client, arguments.path);
    }
    if ("write".equals(arguments.command)) {
      return writeFile(client, arguments.path, arguments.inputFile);
    }
    throw new IllegalArgumentException("Unsupported command: " + arguments.command);
  }

  private static String listFiles(WorkspaceClient client, String path) throws Exception {
    FileNodes nodes = (FileNodes) client.getPool().get(FileNodes.class);
    FileNode[] entries = nodes.list(path);
    StringBuilder builder = new StringBuilder();
    builder.append("{\"items\":[");
    for (int index = 0; index < entries.length; index += 1) {
      if (index > 0) {
        builder.append(',');
      }
      FileNode entry = entries[index];
      builder.append('{')
          .append("\"path\":").append(json(entry.getEnvPath())).append(',')
          .append("\"directory\":").append(entry.isDirectory()).append(',')
          .append("\"lock\":").append(json(entry.getLock()))
          .append('}');
    }
    builder.append("]}");
    return builder.toString();
  }

  private static String readFile(WorkspaceClient client, String path) throws Exception {
    WorkResource resource = (WorkResource) client.getPool().get(WorkResource.class);
    byte[] content = resource.readFully(path);
    return "{\"path\":"
        + json(path)
        + ",\"contentBase64\":"
        + json(Base64.getEncoder().encodeToString(content))
        + "}";
  }

  private static String writeFile(WorkspaceClient client, String path, String inputFile) throws Exception {
    WorkResource resource = (WorkResource) client.getPool().get(WorkResource.class);
    byte[] content = Files.readAllBytes(Paths.get(inputFile));
    String tempPath = buildTempPath(path);
    resource.save(tempPath, path, content);
    return "{\"path\":"
        + json(path)
        + ",\"bytesWritten\":"
        + content.length
        + "}";
  }

  private static String buildTempPath(String path) {
    int slashIndex = path.lastIndexOf('/');
    String directory = slashIndex >= 0 ? path.substring(0, slashIndex) : "";
    String prefix = directory.isEmpty() ? "" : directory + "/";
    return prefix + ".fr-remote-" + UUID.randomUUID() + ".tmp";
  }

  private static String json(String value) {
    if (value == null) {
      return "null";
    }
    StringBuilder builder = new StringBuilder("\"");
    for (int index = 0; index < value.length(); index += 1) {
      char current = value.charAt(index);
      switch (current) {
        case '\\' -> builder.append("\\\\");
        case '"' -> builder.append("\\\"");
        case '\n' -> builder.append("\\n");
        case '\r' -> builder.append("\\r");
        case '\t' -> builder.append("\\t");
        default -> builder.append(current);
      }
    }
    builder.append('"');
    return builder.toString();
  }

  private static final class Arguments {
    private final String command;
    private final String url;
    private final String username;
    private final String password;
    private final String path;
    private final String inputFile;
    private final String outputFile;

    private Arguments(
        String command,
        String url,
        String username,
        String password,
        String path,
        String inputFile,
        String outputFile
    ) {
      this.command = command;
      this.url = url;
      this.username = username;
      this.password = password;
      this.path = path;
      this.inputFile = inputFile;
      this.outputFile = outputFile;
    }

    private static Arguments parse(String[] args) {
      if (args.length == 0) {
        throw new IllegalArgumentException("Missing command");
      }

      String command = args[0];
      Map<String, String> values = parseFlags(args);
      validate(command, values);
      return new Arguments(
          command,
          values.get("--url"),
          values.get("--username"),
          values.get("--password"),
          values.get("--path"),
          values.get("--input-file"),
          values.get("--output-file")
      );
    }

    private static Map<String, String> parseFlags(String[] args) {
      Map<String, String> values = new LinkedHashMap<>();
      for (int index = 1; index < args.length; index += 2) {
        String key = args[index];
        if (!key.startsWith("--")) {
          throw new IllegalArgumentException("Invalid flag: " + key);
        }
        if (index + 1 >= args.length) {
          throw new IllegalArgumentException("Missing value for: " + key);
        }
        values.put(key, args[index + 1]);
      }
      return values;
    }

    private static void validate(String command, Map<String, String> values) {
      require(values, "--url");
      require(values, "--username");
      require(values, "--password");
      require(values, "--path");
      require(values, "--output-file");
      if ("write".equals(command)) {
        require(values, "--input-file");
      }
    }

    private static void require(Map<String, String> values, String key) {
      if (!values.containsKey(key)) {
        throw new IllegalArgumentException("Missing required flag: " + key);
      }
    }
  }
}
