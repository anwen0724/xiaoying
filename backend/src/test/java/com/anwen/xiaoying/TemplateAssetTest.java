package com.anwen.xiaoying;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import com.fasterxml.jackson.databind.ObjectMapper;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class TemplateAssetTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    @Test
    void publicTemplatesAndPrivateValidatedUploads() throws Exception {
        mvc.perform(get("/api/templates")).andExpect(status().isOk())
            .andExpect(jsonPath("items.length()").value(4))
            .andExpect(jsonPath("items[0].title").value("山野明信片"));
        mvc.perform(get("/api/categories")).andExpect(jsonPath("items.length()").value(2));
        mvc.perform(get("/demo/templates.json")).andExpect(status().isNotFound());
        mvc.perform(get("/demo/covers/mountain-card.svg")).andExpect(status().isOk());
        var alice = login("demo-alice");
        var image = new ClassPathResource("demo/inputs/mountain.png").getContentAsByteArray();
        var response = mvc.perform(multipart("/api/assets")
                .file(new MockMultipartFile("file", "../山.png", "text/plain", image))
                .param("templateId", "mountain-card").session(alice))
            .andExpect(status().isCreated()).andExpect(jsonPath("mimeType").value("image/png"))
            .andExpect(jsonPath("originalName").value("山.png")).andReturn();
        String preview = json.readTree(response.getResponse().getContentAsByteArray()).get("previewUrl").asText();
        mvc.perform(get(preview).session(alice)).andExpect(status().isOk()).andExpect(content().bytes(image));
        mvc.perform(get(preview).session(login("demo-bob"))).andExpect(status().isNotFound());
        mvc.perform(multipart("/api/assets")
                .file(new MockMultipartFile("file", "fake.png", "image/png", new byte[]{1,2,3}))
                .param("templateId", "mountain-card").session(alice))
            .andExpect(status().isBadRequest());
    }

    private MockHttpSession login(String id) throws Exception {
        return (MockHttpSession) mvc.perform(post("/api/session").contentType("application/json")
                .content("{\"userId\":\"" + id + "\"}"))
            .andExpect(status().isOk()).andReturn().getRequest().getSession(false);
    }
}
