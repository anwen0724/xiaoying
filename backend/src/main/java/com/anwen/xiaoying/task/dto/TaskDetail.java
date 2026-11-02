package com.anwen.xiaoying.task.dto;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import java.util.List;

public record TaskDetail(@JsonUnwrapped TaskResponse task, List<TaskStep> steps) {
}
