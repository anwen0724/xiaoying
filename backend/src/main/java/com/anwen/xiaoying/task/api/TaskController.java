package com.anwen.xiaoying.task.api;

import com.anwen.xiaoying.common.BusinessException;
import com.anwen.xiaoying.common.Items;
import com.anwen.xiaoying.identity.service.IdentityService;
import com.anwen.xiaoying.task.dto.*;
import com.anwen.xiaoying.task.service.TaskService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.net.URI;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskController {
    private final TaskService tasks;
    private final IdentityService identity;

    @PostMapping
    public ResponseEntity<TaskResponse> create(HttpServletRequest request,
            @Valid @RequestBody CreateTaskRequest body) {
        var task = tasks.create(identity.current(request).id(), body);
        return ResponseEntity.accepted().location(URI.create("/api/tasks/" + task.id())).body(task);
    }

    @GetMapping("/{id}")
    public TaskDetail detail(HttpServletRequest request, @PathVariable String id) {
        return tasks.detail(identity.current(request).id(), id);
    }

    @GetMapping
    public TaskPage history(HttpServletRequest request, @RequestParam(defaultValue = "20") int limit,
            @RequestParam(required = false) String cursor, @RequestParam(required = false) String templateId) {
        return tasks.history(identity.current(request).id(), limit, cursor, templateId);
    }

    @GetMapping("/active")
    public Items<TaskResponse> active(HttpServletRequest request) {
        String userId = identity.current(request).id();
        if (request.getParameter("templateId") != null) {
            throw BusinessException.invalid("未完成任务列表不接受模板筛选");
        }
        return new Items<>(tasks.active(userId));
    }

    @GetMapping("/status")
    public TaskStatuses statuses(HttpServletRequest request, @RequestParam String ids) {
        return tasks.statuses(identity.current(request).id(), ids);
    }

    @GetMapping("/{id}/result")
    public ResponseEntity<byte[]> result(HttpServletRequest request, @PathVariable String id) {
        return ResponseEntity.ok().header("Content-Type", "image/svg+xml")
            .header("Content-Disposition", "inline").body(tasks.result(identity.current(request).id(), id));
    }
}
