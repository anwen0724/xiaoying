package com.anwen.xiaoying.asset;

import com.anwen.xiaoying.common.BusinessException;
import com.anwen.xiaoying.config.AppProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import java.io.IOException;
import java.nio.file.*;

/** 只接收服务端生成的相对路径；私有文件始终通过所有者校验后的接口读取。 */
@Component
@Slf4j
public class FileStorage {
    private final Path root;

    public FileStorage(AppProperties properties) throws IOException {
        root = Path.of(properties.storageRoot()).toAbsolutePath().normalize();
        Files.createDirectories(root);
    }

    public Path readable(String relative) {
        Path path = resolve(relative);
        if (!Files.isRegularFile(path) || !Files.isReadable(path)) {
            throw new BusinessException(500, "FILE_UNAVAILABLE", "文件不可读取");
        }
        return path;
    }

    public byte[] read(String relative) {
        try {
            return Files.readAllBytes(readable(relative));
        } catch (IOException exception) {
            throw new BusinessException(500, "FILE_UNAVAILABLE", "文件读取失败");
        }
    }

    public void write(String relative, byte[] content) throws IOException {
        Path target = resolve(relative);
        Files.createDirectories(target.getParent());
        Path temporary = Files.createTempFile(target.getParent(), ".pending-", ".tmp");
        try {
            Files.write(temporary, content);
            Files.move(temporary, target, StandardCopyOption.ATOMIC_MOVE);
        } finally {
            Files.deleteIfExists(temporary);
        }
    }

    public void remove(String relative) {
        try {
            Files.deleteIfExists(resolve(relative));
        } catch (IOException exception) {
            log.warn("文件清理失败: {}", relative, exception);
        }
    }

    private Path resolve(String relative) {
        Path path = root.resolve(relative).normalize();
        if (!path.startsWith(root)) {
            throw new IllegalArgumentException("存储路径越界");
        }
        return path;
    }
}
