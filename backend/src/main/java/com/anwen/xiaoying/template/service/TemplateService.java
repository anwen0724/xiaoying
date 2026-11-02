package com.anwen.xiaoying.template.service;

import com.anwen.xiaoying.template.dto.*;
import com.anwen.xiaoying.template.entity.TemplateEntity;
import org.springframework.core.io.Resource;
import java.util.List;

/** 模板要求从数据库读取；公开资源仅限种子登记的路径。 */
public interface TemplateService {
    List<TemplateResponse> list(String category);
    List<CategoryResponse> categories();
    TemplateResponse get(String id);
    TemplateEntity require(String id);
    List<String> acceptedTypes(TemplateEntity template);
    Resource publicResource(String path);
    void checkReady();
}
