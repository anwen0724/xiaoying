package com.anwen.xiaoying.asset.api;

import com.anwen.xiaoying.asset.dto.AssetResponse;
import com.anwen.xiaoying.asset.service.AssetService;
import com.anwen.xiaoying.identity.service.IdentityService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/assets")
@RequiredArgsConstructor
public class AssetController {
    private final AssetService assets;
    private final IdentityService identity;

    @PostMapping(consumes = "multipart/form-data")
    public ResponseEntity<AssetResponse> upload(HttpServletRequest request,
            @RequestParam String templateId, @RequestPart MultipartFile file) {
        return ResponseEntity.status(201).body(assets.upload(identity.current(request).id(), templateId, file));
    }

    @GetMapping("/{id}/content")
    public ResponseEntity<byte[]> content(HttpServletRequest request, @PathVariable String id) {
        var asset = assets.requireOwned(identity.current(request).id(), id);
        return ResponseEntity.ok().header("Content-Type", asset.getMimeType())
            .header("Content-Disposition", "inline").body(assets.content(asset));
    }
}
