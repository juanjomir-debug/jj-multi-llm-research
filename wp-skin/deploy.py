import sys, os
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('187.124.184.177', username='root', password='Z4.HCJf8D&A1lU,V', timeout=15)

def run(cmd, timeout=60):
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    return out, err

sftp = client.open_sftp()

# ── Get admin user ID ──────────────────────────────────────────────────────
uid_out, _ = run("mysql -uwpuser -pcea4c8f3442331ffd4e38440 wordpress -sNe \"SELECT ID FROM wp_users LIMIT 1\"")
user_id = uid_out.strip() or '1'
print("User ID:", user_id)

# ── Articles ───────────────────────────────────────────────────────────────
articles = [
    {
        "title":   "Why Multi-LLM Research is the Future of AI-Powered Work",
        "slug":    "multi-llm-research-future-ai",
        "excerpt": "Single-model AI workflows leave capability on the table. Here is why teams are switching to multi-LLM research and how ReliableAI makes it effortless.",
        "body": """<!-- wp:paragraph -->
<p>The way we interact with AI is changing fast. Instead of relying on a single model for every task, forward-thinking teams are now running their queries across <strong>multiple large language models simultaneously</strong> - comparing, synthesizing, and selecting the best output in real time. This is exactly what ReliableAI was built to do.</p>
<!-- /wp:paragraph -->

<!-- wp:heading -->
<h2>The Problem with Single-Model Workflows</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Every AI model has blind spots. GPT-4o excels at structured reasoning and coding. Claude Opus shines at nuanced writing and long-context tasks. Gemini handles multimodal inputs uniquely well. Perplexity Sonar brings real-time web search into the mix. When you commit to just one, you leave capability on the table.</p>
<!-- /wp:paragraph -->

<!-- wp:quote -->
<blockquote class="wp-block-quote"><!-- wp:paragraph -->
<p>The best answer is not always from the model you trust most - it is from the one best suited to the question.</p>
<!-- /wp:paragraph --></blockquote>
<!-- /wp:quote -->

<!-- wp:heading -->
<h2>How Cascade Analysis Works</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>ReliableAI Cascade mode lets you define a priority order of models. Your query runs sequentially: if the first model fails or returns low confidence, the next one takes over automatically. The result? Maximum reliability with zero manual switching.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>This is especially powerful for research workflows where you need consistent, high-quality answers - not just fast ones.</p>
<!-- /wp:paragraph -->

<!-- wp:heading -->
<h2>What This Means for Your Team</h2>
<!-- /wp:heading -->

<!-- wp:list -->
<ul><!-- wp:list-item -->
<li><strong>Reduce hallucinations</strong> by cross-referencing multiple model outputs</li>
<!-- /wp:list-item --><!-- wp:list-item -->
<li><strong>Cut costs</strong> by routing simple queries to cheaper models automatically</li>
<!-- /wp:list-item --><!-- wp:list-item -->
<li><strong>Increase throughput</strong> with parallel multi-model queries</li>
<!-- /wp:list-item --><!-- wp:list-item -->
<li><strong>Future-proof your stack</strong> - add new models as they release without changing your workflow</li>
<!-- /wp:list-item --></ul>
<!-- /wp:list -->

<!-- wp:paragraph -->
<p>Multi-LLM is not a trend. It is the natural evolution of how intelligent work gets done. Try ReliableAI free and run your first parallel research session in under two minutes.</p>
<!-- /wp:paragraph -->"""
    },
    {
        "title":   "Claude vs GPT-4o vs Gemini: Which Model Wins for Research?",
        "slug":    "claude-gpt4o-gemini-comparison-research",
        "excerpt": "Claude, GPT-4o, and Gemini each have distinct strengths. After running thousands of research queries through ReliableAI, here is the honest breakdown.",
        "body": """<!-- wp:paragraph -->
<p>Choosing an AI model for serious research work is not a matter of picking the most hyped one. Each model has distinct strengths that make it better or worse depending on what you are actually trying to accomplish. After running thousands of research queries through ReliableAI, here is what we have learned.</p>
<!-- /wp:paragraph -->

<!-- wp:heading -->
<h2>Claude (Anthropic)</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Claude stands out for <strong>long-context reasoning and nuanced writing</strong>. With a 200K token context window, it handles lengthy documents, legal texts, and complex reports better than any competitor. It also tends to be more transparent about uncertainty - saying it is not sure when it genuinely is not, rather than hallucinating confidently.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p><strong>Best for:</strong> Document analysis, legal research, essay drafting, summarization of long reports.</p>
<!-- /wp:paragraph -->

<!-- wp:heading -->
<h2>GPT-4o (OpenAI)</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>GPT-4o is OpenAI fastest and most capable all-rounder. It handles <strong>structured output, coding, and tool use</strong> exceptionally well. Its reasoning capabilities - especially with the o3/o4 models - make it the go-to for technical and mathematical tasks.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p><strong>Best for:</strong> Code generation, data analysis, structured JSON output, step-by-step reasoning.</p>
<!-- /wp:paragraph -->

<!-- wp:heading -->
<h2>Gemini (Google)</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Gemini 2.5 Pro represents Google strongest showing yet. Its real advantage is <strong>multimodal input</strong> - feeding it images, charts, and mixed-content documents works seamlessly. It also benefits from Google search infrastructure for factual grounding.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p><strong>Best for:</strong> Image analysis, chart reading, fact-checking, multilingual content.</p>
<!-- /wp:paragraph -->

<!-- wp:heading -->
<h2>The Verdict: Stop Choosing</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>The honest answer is that no single model wins every category. That is precisely why <strong>running them in parallel</strong> through ReliableAI gives you an edge no single-model subscription can match. Compare outputs side by side, run Cascade for mission-critical queries, and let the best answer win - regardless of which model produced it.</p>
<!-- /wp:paragraph -->

<!-- wp:quote -->
<blockquote class="wp-block-quote"><!-- wp:paragraph -->
<p>The researchers who get the best results are not the ones with the best model - they are the ones running all of them.</p>
<!-- /wp:paragraph --></blockquote>
<!-- /wp:quote -->

<!-- wp:paragraph -->
<p>Start your free ReliableAI session and run this comparison yourself in minutes.</p>
<!-- /wp:paragraph -->"""
    }
]

for i, art in enumerate(articles, 1):
    # Write SQL to temp file (avoids all shell quoting issues)
    body_esc    = art["body"].replace("\\", "\\\\").replace("'", "\\'")
    title_esc   = art["title"].replace("'", "\\'")
    excerpt_esc = art["excerpt"].replace("'", "\\'")
    slug        = art["slug"]

    sql = (
        "INSERT INTO wp_posts "
        "(post_author, post_date, post_date_gmt, post_content, post_title, post_excerpt, "
        " post_status, comment_status, ping_status, post_name, post_type, "
        " post_modified, post_modified_gmt, to_ping, pinged, post_content_filtered) "
        "VALUES "
        f"({user_id}, NOW(), UTC_TIMESTAMP(), '{body_esc}', '{title_esc}', '{excerpt_esc}', "
        f" 'publish', 'open', 'open', '{slug}', 'post', NOW(), UTC_TIMESTAMP(), '', '', '');"
    )
    with sftp.file('/tmp/wp_insert.sql', 'w') as f:
        f.write(sql)
    out, err = run("mysql -uwpuser -pcea4c8f3442331ffd4e38440 wordpress < /tmp/wp_insert.sql")
    print(f"Article {i}: {'OK' if not err else err}")

# ── Verify ─────────────────────────────────────────────────────────────────
out, _ = run("mysql -uwpuser -pcea4c8f3442331ffd4e38440 wordpress -sNe \"SELECT ID, post_title, post_status FROM wp_posts WHERE post_type='post' ORDER BY ID DESC LIMIT 5\"")
print("Posts in DB:\n", out)

sftp.close()
client.close()
print("Done.")
