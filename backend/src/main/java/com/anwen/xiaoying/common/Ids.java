package com.anwen.xiaoying.common;

import java.util.regex.Pattern;

public final class Ids {
    private static final Pattern UUID = Pattern.compile("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");

    private Ids() {
    }

    public static String uuid(String id) {
        if (id == null || !UUID.matcher(id).matches()) {
            throw BusinessException.invalid("ID 必须是小写 UUID");
        }
        return id;
    }

    public static String code(String value) {
        if (value == null || value.isBlank() || value.length() > 64) {
            throw BusinessException.invalid("标识不能为空且不能超过 64 个字符");
        }
        return value;
    }
}
