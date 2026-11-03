package com.anwen.xiaoying.task.service;

import com.anwen.xiaoying.task.dto.*;
import java.util.List;

/** 所有个人查询显式限定用户；读取操作不推进任务。 */
public interface TaskService {
    TaskResponse create(String userId, CreateTaskRequest request);
    TaskDetail detail(String userId, String id);
    default TaskPage history(String userId, int limit, String cursor, String templateId) {
        return history(userId, limit, cursor, templateId, null);
    }
    TaskPage history(String userId, int limit, String cursor, String templateId, String category);
    default List<TaskResponse> active(String userId) {
        return active(userId, null);
    }
    List<TaskResponse> active(String userId, String category);
    TaskStatuses statuses(String userId, String ids);
    byte[] result(String userId, String id);
}
