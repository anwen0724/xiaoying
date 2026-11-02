package com.anwen.xiaoying.asset.service;

import com.anwen.xiaoying.asset.dto.AssetResponse;
import com.anwen.xiaoying.asset.entity.AssetEntity;
import com.anwen.xiaoying.template.entity.TemplateEntity;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;

/** 上传和读取用户素材；调用方传入从会话取得的用户 ID，不接受客户端指定所有者。 */
public interface AssetService {
    AssetResponse upload(String userId, String templateId, MultipartFile file);
    AssetEntity requireOwned(String userId, String id);
    /** 按输入顺序校验归属和实际文件，供受理及后台素材检查复用。 */
    void validateInputs(String userId, TemplateEntity template, List<String> ids);
    byte[] content(AssetEntity asset);
}
