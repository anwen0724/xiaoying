package com.anwen.xiaoying;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.*;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mock.web.*;
import org.springframework.test.web.servlet.MockMvc;
import java.time.Duration;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TaskQueryTest.FixedTime.class)
class TaskQueryTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    @TestConfiguration
    static class FixedTime {
        @Bean @Primary
        Clock queryTestClock() {
            return Clock.fixed(Instant.parse("2031-01-01T00:00:00Z"), ZoneOffset.UTC);
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"null", "{\"stepDelayMs\":null}", "{\"stepDelayMs\":\"1\"}",
        "{\"stepDelayMs\":1.5}", "{\"stepDelayMs\":30001}", "{\"failAtStage\":\"OTHER\"}"})
    void invalidSimulationIsNotAccepted(String simulation) throws Exception {
        var session = login("demo-alice");
        var uploaded = mvc.perform(multipart("/api/assets")
                .file(new MockMultipartFile("file", "mountain.png", "image/png",
                    new ClassPathResource("demo/inputs/mountain.png").getContentAsByteArray()))
                .param("templateId", "mountain-card").session(session))
            .andExpect(status().isCreated()).andReturn();
        String asset = json.readTree(uploaded.getResponse().getContentAsByteArray()).get("id").asText();
        mvc.perform(post("/api/tasks").session(session).contentType("application/json")
                .content("{\"templateId\":\"mountain-card\",\"assetIds\":[\"" + asset + "\"],\"simulation\":" + simulation + "}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("code").value("VALIDATION_ERROR"));
    }

    @Test
    void historyCursorRetainsAllRowsAndRejectsAnotherIdentity() throws Exception {
        var session = login("demo-bob");
        var uploaded = mvc.perform(multipart("/api/assets")
                .file(new MockMultipartFile("file", "mountain.png", "image/png",
                    new ClassPathResource("demo/inputs/mountain.png").getContentAsByteArray()))
                .param("templateId", "minimal-cover").session(session))
            .andExpect(status().isCreated()).andReturn();
        String asset = json.readTree(uploaded.getResponse().getContentAsByteArray()).get("id").asText();
        var created = new HashSet<String>();
        for (int index = 0; index < 3; index++) {
            var result = mvc.perform(post("/api/tasks").session(session).contentType("application/json")
                    .content(json.writeValueAsBytes(Map.of("templateId", "minimal-cover", "assetIds", List.of(asset)))))
                .andExpect(status().isAccepted()).andReturn();
            created.add(json.readTree(result.getResponse().getContentAsByteArray()).get("id").asText());
        }
        var seen = new HashSet<String>();
        String cursor = null;
        String firstCursor = null;
        do {
            var request = get("/api/tasks").session(session).param("limit", "2").param("templateId", "minimal-cover");
            if (cursor != null) { request.param("cursor", cursor); }
            var page = json.readTree(mvc.perform(request).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray());
            for (var item : page.get("items")) {
                assertThat(seen.add(item.get("id").asText())).isTrue();
            }
            cursor = page.get("nextCursor").isNull() ? null : page.get("nextCursor").asText();
            if (firstCursor == null) { firstCursor = cursor; }
        } while (cursor != null);
        assertThat(seen).containsAll(created);
        assertThat(firstCursor).isNotNull();
        mvc.perform(get("/api/tasks").session(login("demo-alice"))
                .param("templateId", "minimal-cover").param("cursor", firstCursor))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("code").value("INVALID_CURSOR"));
        mvc.perform(get("/api/tasks").session(session).param("cursor", firstCursor))
            .andExpect(status().isBadRequest());
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> {
            for (String id : created) {
                mvc.perform(get("/api/tasks/" + id).session(session))
                    .andExpect(jsonPath("status").value("SUCCEEDED"));
            }
        });
    }

    private MockHttpSession login(String id) throws Exception {
        return (MockHttpSession) mvc.perform(post("/api/session").contentType("application/json")
                .content(json.writeValueAsBytes(Map.of("userId", id))))
            .andExpect(status().isOk()).andReturn().getRequest().getSession(false);
    }
}
