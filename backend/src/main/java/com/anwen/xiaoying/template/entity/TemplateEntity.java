package com.anwen.xiaoying.template.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("templates")
public class TemplateEntity {
    private String id;
    private String title;
    private String description;
    private String category;
    private String categoryName;
    private String coverPath;
    private int requiredImageCount;
    private String acceptedMimeTypes;
    private long maxFileSizeBytes;
    private String resultPresetPath;
    private int sortOrder;
}
