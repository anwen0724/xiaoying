package com.anwen.xiaoying.task.service.impl;

import com.anwen.xiaoying.asset.FileStorage;
import com.anwen.xiaoying.asset.service.AssetService;
import com.anwen.xiaoying.common.*;
import com.anwen.xiaoying.config.AppProperties;
import com.anwen.xiaoying.task.*;
import com.anwen.xiaoying.task.dto.*;
import com.anwen.xiaoying.task.entity.TaskEntity;
import com.anwen.xiaoying.task.mapper.*;
import com.anwen.xiaoying.task.service.TaskService;
import com.anwen.xiaoying.template.service.TemplateService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TaskServiceImpl implements TaskService {
    private final TaskMapper tasks;
    private final TaskStepMapper steps;
    private final TaskStore store;
    private final TaskProcessor processor;
    private final ThreadPoolTaskExecutor taskExecutor;
    private final TemplateService templates;
    private final AssetService assets;
    private final FileStorage files;
    private final AppProperties properties;
    private final ObjectMapper json;
    private final Clock clock;

    @Override
    public TaskResponse create(String userId, CreateTaskRequest request) {
        var override = request.getSimulation();
        if (override != null && !properties.demoMode()) {
            throw new BusinessException(400, "SIMULATION_NOT_ALLOWED", "当前环境不接受模拟参数");
        }
        var template = templates.require(request.getTemplateId());
        assets.validateInputs(userId, template, request.getAssetIds());
        var simulation = new Simulation(override == null || override.getStepDelayMs() == null
            ? properties.simulationStepDelayMs() : override.getStepDelayMs(),
            override == null ? null : override.getFailAtStage());
        var task = new TaskEntity();
        task.setId(UUID.randomUUID().toString());
        task.setUserId(userId);
        task.setTemplateId(template.getId());
        task.setTemplateTitle(template.getTitle());
        task.setStatus("QUEUED");
        task.setCreatedAt(clock.instant().truncatedTo(ChronoUnit.MILLIS));
        task.setSimulationConfig(encodeJson(simulation));
        store.create(task, request.getAssetIds());
        var snapshot = TaskResponse.from(task);
        try {
            taskExecutor.execute(() -> processor.execute(task.getId()));
            return snapshot;
        } catch (TaskRejectedException exception) {
            String code = taskExecutor.getThreadPoolExecutor().isShutdown()
                ? "EXECUTOR_UNAVAILABLE" : "EXECUTOR_CAPACITY_EXCEEDED";
            store.fail(task.getId(), null, code, "执行器无法受理任务，请稍后重新创建");
            return TaskResponse.from(requireOwned(userId, task.getId()));
        }
    }

    @Override
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public TaskDetail detail(String userId, String id) {
        var task = requireOwned(userId, id);
        return new TaskDetail(TaskResponse.from(task), steps.list(id));
    }

    @Override
    public TaskPage history(String userId, int limit, String cursor, String templateId, String category) {
        if (limit < 1 || limit > 100) {
            throw BusinessException.invalid("limit 需要在 1 至 100 之间");
        }
        var query = categoryQuery(userId, category);
        if (templateId != null) {
            query.eq("template_id", Ids.code(templateId));
        }
        if (cursor != null) {
            var position = decodeCursor(cursor, userId, templateId, category);
            query.and(boundary -> boundary.lt("created_at", position.createdAt())
                .or(tie -> tie.eq("created_at", position.createdAt()).lt("id", position.id())));
        }
        query.orderByDesc("created_at", "id").last("LIMIT " + (limit + 1));
        var found = tasks.selectList(query);
        boolean hasMore = found.size() > limit;
        var page = found.subList(0, Math.min(limit, found.size()));
        String next = null;
        if (hasMore) {
            var last = page.getLast();
            var position = new Cursor(1, userId, templateId, category, last.getCreatedAt(), last.getId());
            next = Base64.getUrlEncoder().withoutPadding().encodeToString(
                encodeJson(position).getBytes(java.nio.charset.StandardCharsets.UTF_8));
        }
        return new TaskPage(page.stream().map(TaskResponse::from).toList(), next);
    }

    @Override
    public List<TaskResponse> active(String userId, String category) {
        return tasks.selectList(categoryQuery(userId, category).in("status", "QUEUED", "RUNNING")
                .orderByDesc("created_at", "id"))
            .stream().map(TaskResponse::from).toList();
    }

    @Override
    public TaskStatuses statuses(String userId, String ids) {
        var requested = Arrays.asList(ids.split(",", -1));
        if (requested.isEmpty() || requested.size() > 100 || new HashSet<>(requested).size() != requested.size()) {
            throw BusinessException.invalid("需要 1 至 100 个不同的任务 ID");
        }
        requested.forEach(Ids::uuid);
        var found = tasks.selectList(ownedQuery(userId).in("id", requested)).stream()
            .collect(Collectors.toMap(TaskEntity::getId, Function.identity()));
        var items = new ArrayList<TaskResponse>();
        var missing = new ArrayList<String>();
        for (String id : requested) {
            if (found.containsKey(id)) {
                items.add(TaskResponse.from(found.get(id)));
            } else {
                missing.add(id);
            }
        }
        return new TaskStatuses(items, missing);
    }

    @Override
    public byte[] result(String userId, String id) {
        var task = requireOwned(userId, id);
        if (!"SUCCEEDED".equals(task.getStatus())) {
            throw new BusinessException(409, "RESULT_NOT_READY", "任务还没有可读取的成功结果");
        }
        return files.read(task.getResultPath());
    }

    private TaskEntity requireOwned(String userId, String id) {
        var task = tasks.selectOne(ownedQuery(userId).eq("id", Ids.uuid(id)));
        if (task == null) {
            throw BusinessException.notFound();
        }
        return task;
    }

    private QueryWrapper<TaskEntity> ownedQuery(String userId) {
        return new QueryWrapper<TaskEntity>().eq("user_id", userId);
    }

    private QueryWrapper<TaskEntity> categoryQuery(String userId, String category) {
        var query = ownedQuery(userId);
        if (category != null) {
            query.apply("template_id IN (SELECT id FROM templates WHERE category = {0})", Ids.code(category));
        }
        return query;
    }

    private record Cursor(
        @com.fasterxml.jackson.annotation.JsonProperty(required = true) int v,
        @com.fasterxml.jackson.annotation.JsonProperty(required = true) String userId,
        @com.fasterxml.jackson.annotation.JsonProperty(required = true) String templateId,
        String category,
        @com.fasterxml.jackson.annotation.JsonProperty(required = true) Instant createdAt,
        @com.fasterxml.jackson.annotation.JsonProperty(required = true) String id) {}

    private Cursor decodeCursor(String encoded, String userId, String templateId, String category) {
        try {
            if (encoded.isEmpty() || encoded.length() > 2048) {
                throw new IllegalArgumentException();
            }
            var cursor = json.readValue(Base64.getUrlDecoder().decode(encoded), Cursor.class);
            if (cursor.v() != 1 || !userId.equals(cursor.userId())
                    || !Objects.equals(templateId, cursor.templateId()) || !Objects.equals(category, cursor.category())
                    || cursor.createdAt() == null
                    || cursor.createdAt().getNano() % 1_000_000 != 0) {
                throw new IllegalArgumentException();
            }
            Ids.uuid(cursor.id());
            return cursor;
        } catch (Exception exception) {
            throw new BusinessException(400, "INVALID_CURSOR", "分页位置无效或与当前筛选不匹配");
        }
    }

    private String encodeJson(Object value) {
        try {
            return json.writeValueAsString(value);
        } catch (Exception exception) {
            throw new IllegalStateException("内部 JSON 编码失败", exception);
        }
    }
}
