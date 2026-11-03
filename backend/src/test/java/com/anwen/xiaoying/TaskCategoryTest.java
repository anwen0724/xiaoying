package com.anwen.xiaoying;

import com.anwen.xiaoying.task.entity.TaskEntity;
import com.anwen.xiaoying.task.mapper.TaskMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class TaskCategoryTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired TaskMapper tasks;
    @Autowired JdbcTemplate jdbc;
    private MockHttpSession owner;
    private MockHttpSession other;

    @BeforeEach
    void prepareIdentities() throws Exception {
        for (String id : List.of("category-owner", "category-other")) {
            jdbc.update("INSERT INTO users (id, display_name, created_at) VALUES (?, ?, NOW(3))", id, id);
        }
        owner = login("category-owner");
        other = login("category-other");
    }

    @Test
    void categoryFiltersTheWholeHistoryAndCursorCannotCrossFiltersOrUsers() throws Exception {
        var expected = new HashSet<String>();
        for (int i = 0; i < 23; i++) {
            expected.add(insert("category-owner", i % 2 == 0 ? "minimal-cover" : "inspiration-grid"));
            insert("category-owner", "mountain-card");
        }
        insert("category-other", "minimal-cover");
        var first = history(owner, "design", null);
        assertThat(first.get("items").size()).isEqualTo(20);
        String cursor = first.get("nextCursor").asText();
        var second = history(owner, "design", cursor);
        assertThat(second.get("items").size()).isEqualTo(3);
        assertThat(second.get("nextCursor").isNull()).isTrue();
        var seen = new HashSet<String>();
        for (var page : List.of(first, second)) {
            for (var item : page.get("items")) assertThat(seen.add(item.get("id").asText())).isTrue();
        }
        assertThat(seen).isEqualTo(expected);
        for (String category : List.of("travel", "")) {
            var request = get("/api/tasks").session(owner).param("cursor", cursor);
            if (!category.isEmpty()) request.param("category", category);
            mvc.perform(request).andExpect(status().isBadRequest()).andExpect(jsonPath("code").value("INVALID_CURSOR"));
        }
        mvc.perform(get("/api/tasks").session(other).param("category", "design").param("cursor", cursor))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("code").value("INVALID_CURSOR"));
        mvc.perform(get("/api/tasks").session(owner).param("category", "design").param("templateId", "mountain-card"))
            .andExpect(status().isOk()).andExpect(jsonPath("items").isEmpty());
        mvc.perform(get("/api/tasks").session(owner).param("category", "unknown"))
            .andExpect(status().isOk()).andExpect(jsonPath("items").isEmpty());
        mvc.perform(get("/api/tasks").session(owner).param("category", " "))
            .andExpect(status().isBadRequest());

        var all = history(owner, null, null);
        var legacy = (ObjectNode) json.readTree(Base64.getUrlDecoder().decode(all.get("nextCursor").asText()));
        legacy.remove("category");
        String legacyCursor = Base64.getUrlEncoder().withoutPadding().encodeToString(json.writeValueAsBytes(legacy));
        assertThat(history(owner, null, legacyCursor).get("items").size()).isEqualTo(20);
    }

    @Test
    void activeCategoryRecoveryIsUnpagedAndKeepsTheUnfilteredContract() throws Exception {
        for (int i = 0; i < 24; i++) insert("category-owner", "mountain-card");
        insert("category-owner", "minimal-cover");
        insert("category-other", "mountain-card");
        mvc.perform(get("/api/tasks/active").session(owner).param("category", "travel"))
            .andExpect(status().isOk()).andExpect(jsonPath("items.length()").value(24))
            .andExpect(jsonPath("items[*].templateId", org.hamcrest.Matchers.everyItem(org.hamcrest.Matchers.is("mountain-card"))));
        mvc.perform(get("/api/tasks/active").session(owner))
            .andExpect(status().isOk()).andExpect(jsonPath("items.length()").value(25));
        mvc.perform(get("/api/tasks/active").session(owner).param("category", "unknown"))
            .andExpect(status().isOk()).andExpect(jsonPath("items").isEmpty());
        mvc.perform(get("/api/tasks/active").session(owner).param("category", " "))
            .andExpect(status().isBadRequest());
        mvc.perform(get("/api/tasks/active").session(owner).param("templateId", "mountain-card"))
            .andExpect(status().isBadRequest());
    }

    private JsonNode history(MockHttpSession session, String category, String cursor) throws Exception {
        var request = get("/api/tasks").session(session);
        if (category != null) request.param("category", category);
        if (cursor != null) request.param("cursor", cursor);
        return json.readTree(mvc.perform(request).andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray());
    }

    private String insert(String user, String template) {
        var task = new TaskEntity();
        task.setId(UUID.randomUUID().toString());
        task.setUserId(user);
        task.setTemplateId(template);
        task.setTemplateTitle(template);
        task.setStatus("QUEUED");
        task.setCreatedAt(Instant.parse("2031-01-01T00:00:00Z"));
        task.setSimulationConfig("{}");
        tasks.insert(task);
        return task.getId();
    }

    private MockHttpSession login(String id) throws Exception {
        return (MockHttpSession) mvc.perform(post("/api/session").contentType("application/json")
                .content(json.writeValueAsBytes(Map.of("userId", id))))
            .andExpect(status().isOk()).andReturn().getRequest().getSession(false);
    }
}
