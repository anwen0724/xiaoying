package com.anwen.xiaoying.asset.dto;

public record AssetResponse(String id, String originalName, String mimeType,
                            long sizeBytes, String previewUrl) {
}
