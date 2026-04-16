#!/bin/bash
# Publica el thread completo en Twitter
# Nota: Necesitas obtener el ID del primer tweet manualmente

ACCOUNT="juanjomir"

echo "🐦 Publicando thread en @$ACCOUNT"
echo ""

# Tweet 1 (ya publicado)
echo "✅ Tweet 1/10 ya publicado"
echo ""
echo "Para continuar, necesitas el ID del tweet que acabas de publicar."
echo "1. Ve a https://twitter.com/$ACCOUNT"
echo "2. Abre el tweet que acabas de publicar"
echo "3. Copia el ID de la URL (el número largo después de /status/)"
echo ""
read -p "Pega el ID del tweet aquí: " TWEET_ID

if [ -z "$TWEET_ID" ]; then
  echo "❌ No se proporcionó ID del tweet"
  exit 1
fi

echo ""
echo "📝 Publicando replies..."
echo ""

# Tweet 2
node tweet-playwright.js --account $ACCOUNT --reply $TWEET_ID --text "2/ Where ALL models agree:

• Net +78M jobs by 2030 (WEF)
• Middle-skill workers crushed
• AI skills = 23-56% salary premium

But here's where it gets interesting..."

sleep 3

# Tweet 3
node tweet-playwright.js --account $ACCOUNT --reply $TWEET_ID --text "3/ The models split into 2 camps:

Camp 1 (GPT, Qwen, Grok): \"Manageable disruption\"
→ Temporary 0.3-0.6% unemployment bump

Camp 2 (Claude, Gemini): \"Structural fracture\"
→ The junior-to-senior pipeline is collapsing"

sleep 3

# Tweet 4
node tweet-playwright.js --account $ACCOUNT --reply $TWEET_ID --text "4/ The pipeline collapse is the scariest prediction:

If AI absorbs entry-level work, you never become a senior professional.

No junior analyst jobs → No senior analysts in 10 years

This isn't automation. It's destroying the apprenticeship ladder."

sleep 3

# Tweet 5
node tweet-playwright.js --account $ACCOUNT --reply $TWEET_ID --text "5/ The stat that matters:

77% of emerging AI roles require a master's degree or equivalent.

You can't retrain millions of admin workers into ML engineers in 2-3 years.

The math doesn't work."

sleep 3

# Tweet 6
node tweet-playwright.js --account $ACCOUNT --reply $TWEET_ID --text "6/ What only ONE model mentioned:

79% of employed women in the US work in high-automation-risk positions vs 58% of men.

4.7% of women's jobs face severe AI disruption vs 2.4% for men.

This should have been raised by all of them."

sleep 3

# Tweet 7
node tweet-playwright.js --account $ACCOUNT --reply $TWEET_ID --text "7/ Winners:
• AI-fluent professionals
• Physical-skill workers (trades, healthcare)
• Early-adopter firms

Losers:
• Entry-level knowledge workers (Gen Z)
• Women in admin/support
• Workers in mid-size cities"

sleep 3

# Tweet 8
node tweet-playwright.js --account $ACCOUNT --reply $TWEET_ID --text "8/ This isn't theoretical:

• Amazon: 30,000+ positions eliminated
• Salesforce: 4,000 support roles cut
• MIT study: 11.7% of jobs could be automated TODAY

The gap between \"could be\" and \"has been\" is closing fast."

sleep 3

# Tweet 9
node tweet-playwright.js --account $ACCOUNT --reply $TWEET_ID --text "9/ What to do:

Stop planning for the average. Plan for the distribution.

Audit every role for AI complementarity in the next 90 days.

Invest in skills at the intersection of AI fluency + human judgment."

sleep 3

# Tweet 10
node tweet-playwright.js --account $ACCOUNT --reply $TWEET_ID --text "10/ Full article with all the data, charts, and blind spots:

https://reliableai.app/blog/posts/2026-04-15-ai-won-t-kill-jobs-it-will-kill-your-job.html

Produced using @ReliableAI_app — 5 AI models researching independently.

#AI #FutureOfWork #Employment"

echo ""
echo "🎉 Thread completo publicado!"
