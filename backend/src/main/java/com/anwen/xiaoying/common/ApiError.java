package com.anwen.xiaoying.common;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Map;

public record ApiError(String code, String message,
                       @JsonInclude(JsonInclude.Include.NON_EMPTY) Map<String, String> fieldErrors) {
    public ApiError(String code, String message) {
        this(code, message, Map.of());
    }
}
