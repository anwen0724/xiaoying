package com.anwen.xiaoying.template.api;

import com.anwen.xiaoying.common.Items;
import com.anwen.xiaoying.template.dto.*;
import com.anwen.xiaoying.template.service.TemplateService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class TemplateController {
    private final TemplateService templates;

    @GetMapping("/api/health")
    public Map<String, String> health() {
        templates.checkReady();
        return Map.of("status", "UP");
    }

    @GetMapping("/api/categories")
    public Items<CategoryResponse> categories() {
        return new Items<>(templates.categories());
    }

    @GetMapping("/api/templates")
    public Items<TemplateResponse> list(@RequestParam(required = false) String category) {
        return new Items<>(templates.list(category));
    }

    @GetMapping("/api/templates/{id}")
    public TemplateResponse get(@PathVariable String id) {
        return templates.get(id);
    }

    @GetMapping("/demo/{*path}")
    public ResponseEntity<Resource> resource(@PathVariable String path) {
        return ResponseEntity.ok().header("Content-Type", "image/svg+xml")
            .body(templates.publicResource(path.substring(1)));
    }
}
