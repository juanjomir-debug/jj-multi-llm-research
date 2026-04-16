# Twitter Engagement Automation for @juanjomir

Automated system to find relevant AI conversations and generate high-quality responses to promote ReliableAI organically.

## 🎯 Strategy Overview

- **10 responses/day** to quality AI/LLM discussions
- **40% pure value** (no promotion)
- **40% ReliableAI philosophy** (subtle concepts)
- **15% soft mentions** (@ReliableAI_app)
- **5% direct links** (reliableai.app)

Full strategy: [Twitter-Engagement-Strategy.md](../Twitter-Engagement-Strategy.md)

---

## 📦 Installation

```bash
# Install dependencies
npm install playwright openai node-cron

# Configure environment
cp .env.example .env
# Edit .env and add:
# - OPENAI_API_KEY
# - TWITTER_AUTH_TOKEN (from browser cookies)
```

---

## 🚀 Quick Start

### Option 1: Manual Daily Workflow

```bash
# 1. Find candidates (run 3x/day: morning, afternoon, evening)
node engagement-finder.js

# 2. Review and publish
node engagement-publisher.js
```

### Option 2: Automated Scheduler

```bash
# Run scheduler (keeps running in background)
node engagement-scheduler.js

# Or use PM2 for production
pm2 start engagement-scheduler.js --name twitter-engagement
```

---

## 📁 Files

### `engagement-finder.js`
**Searches for relevant tweets and generates response drafts**

Features:
- Searches 12 AI-related keywords
- Filters by quality (min 50 likes, 10K views)
- AI analysis of relevance (0-10 score)
- Generates response drafts with GPT-4
- Suggests response type (value/philosophy/mention/link)
- Saves top 10 candidates to JSON

Output: `engagement-candidates-YYYY-MM-DD.json`

### `engagement-publisher.js`
**Interactive tool to review and publish responses**

Features:
- Review each candidate one by one
- See tweet context and engagement metrics
- Edit AI-generated draft before publishing
- Give likes without replying
- Skip low-quality opportunities
- Automatic 10-min delays between responses
- Activity logging

Output: `engagement-log-YYYY-MM-DD.json`

### `engagement-scheduler.js`
**Automated scheduler for optimal timing**

Schedule:
- 9:00 AM EST - Morning search
- 2:00 PM EST - Afternoon search
- 8:00 PM EST - Evening search
- 11:00 PM EST - Daily report

---

## 🎨 Response Examples

### Pure Value (40%)
```
Interesting point. In my experience, Claude 3.5 Sonnet outperforms 
GPT-4 on long contract analysis (>50 pages), but GPT-4o is better 
for structuring tabular data.

Context matters more than the model.
```

### Philosophy (40%)
```
This is exactly why I run critical queries through multiple models.

Last week: legal memo analysis
- GPT-4: "low risk"
- Claude: "moderate risk"  
- Gemini: "high risk"

Model disagreement revealed a clause GPT-4 missed entirely.

Single-model = blind spot.
```

### Soft Mention (15%)
```
Totally agree. That's why I built @ReliableAI_app

Run the same query through Claude, GPT, Gemini & Grok simultaneously.
See where they agree (confidence ↑) and where they contradict (dig deeper).

Saved me from a $50K mistake last month.
```

### Direct Link (5%)
```
I use https://reliableai.app for this exact workflow.

Runs your query through 4-8 models in parallel, flags contradictions, 
and synthesizes a verified answer.

Free tier gives you 3 researches/day. Worth trying.
```

---

## 📊 Tracking

### Daily Metrics
- Responses published
- Likes given
- Response type distribution
- Average relevance score

### Weekly Review
- Total impressions
- Engagement rate
- New followers
- Third-party mentions of @ReliableAI_app

Files:
- `engagement-log-YYYY-MM-DD.json` - Daily activity
- `engagement-candidates-YYYY-MM-DD.json` - Found opportunities

---

## ⚙️ Configuration

### Search Keywords (edit in `engagement-finder.js`)
```javascript
keywords: [
  'ChatGPT vs Claude',
  'GPT-4 vs Claude',
  'Gemini vs ChatGPT',
  'Grok AI',
  'LLM comparison',
  'AI hallucination',
  'AI reliability',
  'prompt engineering',
  'enterprise AI',
  'multi-agent AI',
  'AI benchmarks',
  'model disagreement'
]
```

### Quality Filters
```javascript
minLikes: 50,
minViews: 10000,
minFollowers: 5000,
maxAge: 24 // hours
```

### Timing
```javascript
delayBetweenReplies: 10 * 60 * 1000 // 10 minutes
```

---

## 🔒 Security

- Never commit `.env` file
- Twitter auth tokens expire - refresh monthly
- Use read-only API keys when possible
- Review all responses before publishing (no auto-post)

---

## 🐛 Troubleshooting

### "No candidates found"
- Check Twitter auth token is valid
- Try different keywords
- Lower quality filters temporarily

### "Error publishing reply"
- Twitter may have rate limits
- Wait 15 minutes and retry
- Check if tweet still exists

### "AI analysis fails"
- Verify OPENAI_API_KEY is valid
- Check API quota/billing
- Reduce batch size

---

## 📈 Success Metrics

After 30 days, you should see:
- 300+ quality responses published
- 50-75 organic mentions of ReliableAI
- +500 followers
- 10-15 deep conversations with thought leaders
- 2-3 viral threads (>10K views)

---

## 🎯 Best Practices

### DO:
✅ Provide real value before promoting
✅ Use concrete data and examples
✅ Be genuine and conversational
✅ Reply to responses on your replies
✅ Thank people when they mention you
✅ Admit when you don't know something

### DON'T:
❌ Copy-paste generic responses
❌ Spam links
❌ Respond to everything with "use ReliableAI"
❌ Get into toxic debates
❌ Respond to trolls
❌ Use promotional language ("amazing", "revolutionary")

---

## 🔄 Daily Workflow

**Morning (9:00 AM)**
1. Run `engagement-finder.js`
2. Review candidates over coffee
3. Publish 3-4 responses with `engagement-publisher.js`

**Afternoon (2:00 PM)**
1. Run `engagement-finder.js` again
2. Publish 3-4 more responses
3. Give 10-15 likes to quality content

**Evening (8:00 PM)**
1. Final search run
2. Publish remaining 2-3 responses
3. Review day's engagement

**Night (11:00 PM)**
1. Check daily report
2. Adjust strategy if needed

---

## 📞 Support

Questions? Check:
- [Twitter-Engagement-Strategy.md](../Twitter-Engagement-Strategy.md) - Full strategy
- [Publicacionrespuestas-MEJORADO.md](../Publicacionrespuestas-MEJORADO.md) - Spanish version

---

## 🚀 Next Steps

1. Run your first search: `node engagement-finder.js`
2. Review candidates: check the generated JSON file
3. Publish responses: `node engagement-publisher.js`
4. Track results: review daily logs
5. Optimize: adjust keywords and filters based on what works

Good luck building your AI thought leadership! 🎯
