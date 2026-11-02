package com.anwen.xiaoying.template.dto;

import java.util.List;

public record TemplateResponse(String id, String title, String category, String categoryName,
        String description, String coverUrl, int requiredImageCount,
        List<String> acceptedMimeTypes, long maxFileSizeBytes) {
}
