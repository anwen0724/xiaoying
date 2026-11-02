package com.anwen.xiaoying.template.service.impl;

import com.anwen.xiaoying.common.BusinessException;
import com.anwen.xiaoying.common.Ids;
import com.anwen.xiaoying.template.dto.*;
import com.anwen.xiaoying.template.entity.TemplateEntity;
import com.anwen.xiaoying.template.mapper.TemplateMapper;
import com.anwen.xiaoying.template.service.TemplateService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.*;

@Service
@RequiredArgsConstructor
public class TemplateServiceImpl implements TemplateService, ApplicationRunner {
    private final TemplateMapper mapper;
    private final ObjectMapper json;
    private final TransactionTemplate transactions;
    private volatile Set<String> publicPaths = Set.of();
    private volatile boolean ready;

    @Override
    public void run(ApplicationArguments arguments) throws Exception {
        var seeds = json.readTree(new ClassPathResource("demo/templates.json").getInputStream());
        var paths = new HashSet<String>();
        var names = new HashMap<String, String>();
        var entities = new ArrayList<TemplateEntity>();
        for (var seed : seeds) {
            var copy = seed.deepCopy();
            ((com.fasterxml.jackson.databind.node.ObjectNode) copy)
                .put("acceptedMimeTypes", seed.get("acceptedMimeTypes").toString());
            var entity = json.treeToValue(copy, TemplateEntity.class);
            if (entity.getRequiredImageCount() < 1 || acceptedTypes(entity).isEmpty()) {
                throw new IllegalStateException("模板图片要求无效");
            }
            for (String path : List.of(entity.getCoverPath(), entity.getResultPresetPath())) {
                if (!path.matches("(covers|results)/[a-z0-9-]+\\.svg")
                        || !new ClassPathResource("demo/" + path).exists()) {
                    throw new IllegalStateException("预置文件未登记或不存在");
                }
                paths.add(path);
            }
            String previous = names.putIfAbsent(entity.getCategory(), entity.getCategoryName());
            if (previous != null && !previous.equals(entity.getCategoryName())) {
                throw new IllegalStateException("同分类名称不一致");
            }
            entities.add(entity);
        }
        transactions.executeWithoutResult(status -> {
            for (var entity : entities) {
                if (mapper.selectById(entity.getId()) == null) {
                    mapper.insert(entity);
                }
            }
            var storedNames = new HashMap<String, String>();
            for (var entity : mapper.selectList(null)) {
                String previous = storedNames.putIfAbsent(entity.getCategory(), entity.getCategoryName());
                if (previous != null && !previous.equals(entity.getCategoryName())) {
                    throw new IllegalStateException("数据库模板分类名称不一致");
                }
                if (!paths.contains(entity.getCoverPath()) || !paths.contains(entity.getResultPresetPath())) {
                    throw new IllegalStateException("数据库模板引用未登记文件");
                }
            }
        });
        publicPaths = Set.copyOf(paths);
        ready = true;
    }

    @Override
    public List<TemplateResponse> list(String category) {
        var query = new QueryWrapper<TemplateEntity>().orderByAsc("sort_order", "id");
        if (category != null) {
            query.eq("category", Ids.code(category));
        }
        return mapper.selectList(query).stream().map(this::response).toList();
    }

    @Override
    public List<CategoryResponse> categories() {
        return mapper.selectList(new QueryWrapper<TemplateEntity>().orderByAsc("category"))
            .stream().map(t -> new CategoryResponse(t.getCategory(), t.getCategoryName())).distinct().toList();
    }

    @Override
    public TemplateResponse get(String id) {
        return response(require(id));
    }

    @Override
    public TemplateEntity require(String id) {
        var template = mapper.selectById(Ids.code(id));
        if (template == null) {
            throw BusinessException.notFound();
        }
        return template;
    }

    @Override
    public List<String> acceptedTypes(TemplateEntity template) {
        try {
            return json.readValue(template.getAcceptedMimeTypes(), new TypeReference<List<String>>() {});
        } catch (Exception exception) {
            throw new IllegalStateException("模板 MIME 配置无效", exception);
        }
    }

    @Override
    public Resource publicResource(String path) {
        if (!publicPaths.contains(path)) {
            throw BusinessException.notFound();
        }
        return new ClassPathResource("demo/" + path);
    }

    @Override
    public void checkReady() {
        if (!ready || mapper.ping() != 1) {
            throw new BusinessException(503, "DEPENDENCY_UNAVAILABLE", "初始化尚未完成");
        }
    }

    private TemplateResponse response(TemplateEntity t) {
        return new TemplateResponse(t.getId(), t.getTitle(), t.getCategory(), t.getCategoryName(),
            t.getDescription(), "/demo/" + t.getCoverPath(), t.getRequiredImageCount(),
            acceptedTypes(t), t.getMaxFileSizeBytes());
    }
}
