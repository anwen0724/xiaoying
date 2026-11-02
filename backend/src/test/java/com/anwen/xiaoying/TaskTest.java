package com.anwen.xiaoying;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class TaskTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired com.anwen.xiaoying.config.AppProperties properties;

    @ParameterizedTest
    @ValueSource(strings = {"NONE", "MATERIAL_CHECK", "MOCK_GENERATION", "RESULT_FINALIZATION"})
    void taskProgressesWithoutQueriesAndPersistsOrderedOutcome(String failure) throws Exception {
        var session = (MockHttpSession) mvc.perform(post("/api/session").contentType("application/json")
                .content("{\"userId\":\"demo-alice\"}"))
            .andReturn().getRequest().getSession(false);
        var upload = mvc.perform(multipart("/api/assets")
                .file(new MockMultipartFile("file", "mountain.png", "image/png",
                    new ClassPathResource("demo/inputs/mountain.png").getContentAsByteArray()))
                .param("templateId", "mountain-card").session(session))
            .andExpect(status().isCreated()).andReturn();
        String assetId = json.readTree(upload.getResponse().getContentAsByteArray()).get("id").asText();
        var simulation = failure.equals("NONE") ? Map.of("stepDelayMs", 0)
            : Map.of("stepDelayMs", 0, "failAtStage", failure);
        var submitted = mvc.perform(post("/api/tasks").session(session).contentType("application/json")
                .content(json.writeValueAsBytes(Map.of("templateId", "mountain-card",
                    "assetIds", List.of(assetId), "simulation", simulation))))
            .andExpect(status().isAccepted()).andReturn();
        String id = json.readTree(submitted.getResponse().getContentAsByteArray()).get("id").asText();
        String expected = failure.equals("NONE") ? "SUCCEEDED" : "FAILED";
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() ->
            assertThat(detail(session, id).get("status").asText()).isEqualTo(expected));
        JsonNode done = detail(session, id);
        assertThat(done.get("createdAt").asText()).matches(".*\\.\\d{3}Z");
        var stages = List.of("MATERIAL_CHECK", "MOCK_GENERATION", "RESULT_FINALIZATION");
        int failedPosition = stages.indexOf(failure);
        for (int i = 0; i < 3; i++) {
            var step = done.get("steps").get(i);
            assertThat(step.get("stage").asText()).isEqualTo(stages.get(i));
            String state = failedPosition < 0 || i < failedPosition ? "SUCCEEDED"
                : i == failedPosition ? "FAILED" : "SKIPPED";
            assertThat(step.get("status").asText()).isEqualTo(state);
        }
        mvc.perform(get("/api/tasks/" + id + "/result").session(session))
            .andExpect(status().is(failure.equals("NONE") ? 200 : 409));
        if (failure.equals("NONE")) {
            var path = java.nio.file.Path.of(properties.storageRoot(), "results", id, "result.svg");
            byte[] saved = java.nio.file.Files.readAllBytes(path);
            try {
                java.nio.file.Files.delete(path);
                mvc.perform(get("/api/tasks/" + id + "/result").session(session))
                    .andExpect(status().isInternalServerError()).andExpect(jsonPath("code").value("FILE_UNAVAILABLE"));
            } finally {
                java.nio.file.Files.write(path, saved);
            }
        }
        assertThat(detail(session, id)).isEqualTo(done);
        var bob = (MockHttpSession) mvc.perform(post("/api/session").contentType("application/json")
                .content("{\"userId\":\"demo-bob\"}"))
            .andReturn().getRequest().getSession(false);
        mvc.perform(get("/api/tasks/" + id).session(bob)).andExpect(status().isNotFound());
        mvc.perform(get("/api/tasks/status").param("ids", id).session(bob))
            .andExpect(status().isOk()).andExpect(jsonPath("missingIds[0]").value(id));
    }

    private JsonNode detail(MockHttpSession session, String id) throws Exception {
        var result = mvc.perform(get("/api/tasks/" + id).session(session))
            .andExpect(status().isOk()).andReturn();
        return json.readTree(result.getResponse().getContentAsByteArray());
    }
}
