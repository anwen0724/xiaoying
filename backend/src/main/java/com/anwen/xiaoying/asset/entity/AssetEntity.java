package com.anwen.xiaoying.asset.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.Instant;

@Data
@TableName("assets")
public class AssetEntity {
    private String id;
    private String userId;
    private String originalName;
    private String storagePath;
    private String mimeType;
    private long sizeBytes;
    private Instant createdAt;
}
