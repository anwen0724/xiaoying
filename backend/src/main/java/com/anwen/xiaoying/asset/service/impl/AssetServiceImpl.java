package com.anwen.xiaoying.asset.service.impl;

import com.anwen.xiaoying.asset.FileStorage;
import com.anwen.xiaoying.asset.dto.AssetResponse;
import com.anwen.xiaoying.asset.entity.AssetEntity;
import com.anwen.xiaoying.asset.mapper.AssetMapper;
import com.anwen.xiaoying.asset.service.AssetService;
import com.anwen.xiaoying.common.*;
import com.anwen.xiaoying.template.entity.TemplateEntity;
import com.anwen.xiaoying.template.service.TemplateService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import javax.imageio.ImageIO;
import java.io.*;
import java.time.Clock;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
@RequiredArgsConstructor
public class AssetServiceImpl implements AssetService {
    private final AssetMapper mapper;
    private final TemplateService templates;
    private final FileStorage files;
    private final Clock clock;

    @Override
    public AssetResponse upload(String userId, String templateId, MultipartFile file) {
        var template = templates.require(templateId);
        String name = Optional.ofNullable(file.getOriginalFilename()).orElse("").replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1);
        if (name.isBlank() || name.length() > 255) {
            throw BusinessException.invalid("文件名需要 1 至 255 个字符");
        }
        checkSize(file.getSize(), template);
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException exception) {
            throw new BusinessException(500, "FILE_UNAVAILABLE", "上传内容读取失败");
        }
        String mime = validateImage(bytes, template);
        String id = UUID.randomUUID().toString();
        String path = "uploads/" + id;
        var entity = new AssetEntity();
        entity.setId(id);
        entity.setUserId(userId);
        entity.setOriginalName(name);
        entity.setStoragePath(path);
        entity.setMimeType(mime);
        entity.setSizeBytes(bytes.length);
        entity.setCreatedAt(clock.instant().truncatedTo(ChronoUnit.MILLIS));
        try {
            files.write(path, bytes);
            mapper.insert(entity);
        } catch (IOException exception) {
            files.remove(path);
            throw new BusinessException(500, "FILE_UNAVAILABLE", "素材保存失败");
        } catch (RuntimeException exception) {
            files.remove(path);
            throw exception;
        }
        return new AssetResponse(id, name, mime, bytes.length, "/api/assets/" + id + "/content");
    }

    @Override
    public AssetEntity requireOwned(String userId, String id) {
        var asset = mapper.selectById(Ids.uuid(id));
        if (asset == null || !asset.getUserId().equals(userId)) {
            throw BusinessException.notFound();
        }
        return asset;
    }

    @Override
    public void validateInputs(String userId, TemplateEntity template, List<String> ids) {
        if (ids == null || ids.size() != template.getRequiredImageCount()
                || new HashSet<>(ids).size() != ids.size()) {
            throw BusinessException.invalid("素材数量必须符合模板要求且不能重复");
        }
        for (String id : ids) {
            var asset = requireOwned(userId, id);
            validateImage(content(asset), template);
        }
    }

    @Override
    public byte[] content(AssetEntity asset) {
        return files.read(asset.getStoragePath());
    }

    private void checkSize(long size, TemplateEntity template) {
        if (size == 0) {
            throw new BusinessException(400, "INVALID_IMAGE", "图片内容为空");
        }
        if (size > Math.min(template.getMaxFileSizeBytes(), 5L * 1024 * 1024)) {
            throw new BusinessException(413, "FILE_TOO_LARGE", "图片超过大小限制");
        }
    }

    private String validateImage(byte[] bytes, TemplateEntity template) {
        checkSize(bytes.length, template);
        try (var input = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            var readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) {
                throw new BusinessException(400, "INVALID_IMAGE", "无法识别图片内容");
            }
            var reader = readers.next();
            try {
                String format = reader.getFormatName().toLowerCase(Locale.ROOT);
                String mime = switch (format) {
                    case "png" -> "image/png";
                    case "jpeg", "jpg" -> "image/jpeg";
                    default -> "image/" + format;
                };
                if (!templates.acceptedTypes(template).contains(mime)) {
                    throw new BusinessException(415, "UNSUPPORTED_MEDIA_TYPE", "模板不接受该图片类型");
                }
                reader.setInput(input);
                reader.read(0);
                return mime;
            } finally {
                reader.dispose();
            }
        } catch (IOException | IllegalArgumentException exception) {
            throw new BusinessException(400, "INVALID_IMAGE", "图片已损坏或无法解码");
        }
    }
}
