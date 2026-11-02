package com.anwen.xiaoying.task.dto;

import java.util.List;

public record TaskPage(List<TaskResponse> items, String nextCursor) {
}
