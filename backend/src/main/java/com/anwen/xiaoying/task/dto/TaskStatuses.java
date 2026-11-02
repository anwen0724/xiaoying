package com.anwen.xiaoying.task.dto;

import java.util.List;

public record TaskStatuses(List<TaskResponse> items, List<String> missingIds) {
}
