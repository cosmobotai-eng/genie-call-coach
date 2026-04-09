/**
 * Mock Transcript Generator for Genie Call Coach Phase 1 Demo
 * 
 * Simulates a realistic sales discovery call without any API keys.
 * Generates transcript segments that look like real sales conversation,
 * with realistic timing, speakers, and content.
 */

const SALES_REP = {
  id: 1,
  name: 'Alex',
  is_host: false,
  platform: 'Zoom'
};

const PROSPECT = {
  id: 2,
  name: 'Jordan',
  is_host: true,
  platform: null,
  email: 'jordan.chen@techflow.io'
};

// Realistic sales call segments — discovery call at TechFlow
// Topics: workflow automation, team size, current tools, budget, timeline, competitors
const CALL_SCRIPT = [
  // === OPENING (0-2 min) ===
  { speaker: PROSPECT, duration: 1800, text: "Hey Alex, thanks for reaching out. I've been drowning in manual data entry for the past three months, so I'm excited to chat about what you guys do." },
  { speaker: SALES_REP, duration: 2500, text: "Jordan, really appreciate you making time. I saw TechFlow just hit 40 employees — congrats on the growth. So tell me, what's the biggest bottleneck right now when it comes to your data workflows?" },
  { speaker: PROSPECT, duration: 3200, text: "Honestly? Our ops team is spending probably 15 hours a week just copying and pasting between Salesforce, Slack, and our ERP. We hired two people last quarter just to handle the backlog. It's killing us." },
  
  // === DISCOVERY (2-5 min) ===
  { speaker: SALES_REP, duration: 2800, text: "That's a classic symptoms of scale. When companies hit your size, the tools that got them there start becoming the bottleneck. So you've got Salesforce, Slack, and your ERP — what does your ops team look like today?" },
  { speaker: PROSPECT, duration: 4000, text: "We've got a core ops team of six people, but two of them are basically just doing data entry. We've talked about hiring one more, but the market for good ops people is tough right now. Plus even if we hire, the problem doesn't really go away, right? We're still doing the same repetitive work." },
  { speaker: SALES_REP, duration: 2200, text: "Exactly right. Hiring to solve a process problem is like buying more chairs when your table is too small. So when you say the data entry backlog is slowing you down — what specifically suffers? Reporting? Customer experience? Decision-making?" },
  { speaker: PROSPECT, duration: 3500, text: "All of the above, honestly. Our weekly board deck is always late because someone has to pull the numbers manually. And we had a customer last month who didn't get onboarded for two weeks because the new account data never made it from sales to ops. We lost two weeks of revenue on that one deal." },
  
  // === BUDGET EXPLORATION (5-8 min) ===
  { speaker: SALES_REP, duration: 3000, text: "That customer onboarding lag is expensive. So when you're thinking about solving this — and correct me if I'm wrong — you're probably looking at this as either a point solution for the Salesforce-to-ERP sync, or you're thinking bigger about automating your entire ops workflow. Which camp are you in?" },
  { speaker: PROSPECT, duration: 2800, text: "Honestly, at first I just wanted to fix the Salesforce problem. But the more I looked into it, the more I realized the real issue is that we have data everywhere and no one knows what's true. We have three different places where customer data lives. I want one source of truth." },
  { speaker: SALES_REP, duration: 2000, text: "That's a much more powerful vision. One source of truth changes how decisions get made. So when you say you want to get there — what's your timeline? Are you under pressure to solve this by end of quarter, or is this more of a H1 priority?" },
  { speaker: PROSPECT, duration: 2200, text: "I'd love to have a proof of concept by end of Q2. My CFO keeps asking why we're paying two salaries for data entry when we could be deploying those people on higher-leverage work. So pressure is definitely there." },
  
  // === COMPETITOR / ALTERNATIVES (8-11 min) ===
  { speaker: SALES_REP, duration: 2500, text: "Understood. And I have to ask — what have you already looked at? Sometimes knowing what didn't work helps me figure out if we're actually a fit." },
  { speaker: PROSPECT, duration: 4000, text: "We talked to Zapier, obviously. But their logic jumps get complicated fast, and we outgrew what we could do without an engineer. We also looked at Workato, but their enterprise pricing was way out of our range for where we are right now. A colleague at DataSync mentioned you guys do this differently — more of a build-it-yourself approach." },
  { speaker: SALES_REP, duration: 2000, text: "That's a fair characterization. We give your ops team the tools to build and maintain their own automations — no engineers needed for day-to-day changes. That matters a lot at your stage because your workflows are going to keep evolving." },
  { speaker: PROSPECT, duration: 1800, text: "Yeah, that's what drew me in. We're not a tech company, but we're always building new things. We need something that can keep up." },
  
  // === STAKEHOLDER / CLOSING (11-14 min) ===
  { speaker: SALES_REP, duration: 2800, text: "Totally. So Jordan, I want to make sure I'm bringing the right solution to the table. Besides yourself, who's going to be involved in this decision? Your CFO you mentioned — is she the final say, or do you need to put together a recommendation?" },
  { speaker: PROSPECT, duration: 3000, text: "I'm the recommendation and budget authority. Sarah, my CFO, cares about ROI, which I have to prove. But she's not going to block anything that clearly solves the problem. What I need to show her is that this isn't another tool that creates more work than it saves." },
  { speaker: SALES_REP, duration: 2500, text: "That's a totally reasonable bar. So let me ask you this — if we could show you a proof of concept where your ops team is spending 80% less time on manual data entry within 30 days — is that the kind of ROI that would make this an easy yes for Q2?" },
  { speaker: PROSPECT, duration: 2000, text: "If you can actually deliver that? Yeah. I want to schedule a technical deep dive with my ops leads. Can we get something on the calendar for next week?" },
  { speaker: SALES_REP, duration: 1500, text: "Absolutely. I'll send you a calendar invite for Thursday — how does 2pm Pacific work? And Jordan — one last thing — what would make you hesitant to move forward after today's call?" },
  { speaker: PROSPECT, duration: 2500, text: "Honestly? Implementation time. We've been burned before by tools that took three months to set up and by the time we were live, the problem had evolved. I need something that can actually get to value fast. I want to see results in weeks, not quarters." },
];

// Convert script to timed transcript entries
let cumulativeTime = 0;
const transcript = [];

for (const segment of CALL_SCRIPT) {
  transcript.push({
    id: transcript.length + 1,
    speaker: segment.speaker.name,
    speakerId: segment.speaker.id,
    isHost: segment.speaker.is_host,
    email: segment.speaker.email || null,
    timestamp: formatElapsed(cumulativeTime * 1000),
    text: segment.text,
    duration: segment.duration,
  });
  cumulativeTime += segment.duration;
}

function formatElapsed(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getTranscriptUpTo(elapsedMs) {
  let accumulated = 0;
  const entries = [];
  for (const segment of CALL_SCRIPT) {
    if (accumulated >= elapsedMs) break;
    const entryText = segment.text;
    const entryDuration = segment.duration;
    const textToShow = accumulated + entryDuration <= elapsedMs 
      ? entryText 
      : entryText.substring(0, Math.floor(entryText.length * (elapsedMs - accumulated) / entryDuration));
    
    if (elapsedMs - accumulated > 0) {
      entries.push({
        id: entries.length + 1,
        speaker: segment.speaker.name,
        speakerId: segment.speaker.id,
        isHost: segment.speaker.is_host,
        email: segment.speaker.email || null,
        timestamp: formatElapsed(accumulated * 1000),
        text: textToShow,
        duration: Math.min(entryDuration, elapsedMs - accumulated),
      });
    }
    accumulated += entryDuration;
  }
  return entries;
}

function getFullTranscript() {
  return transcript;
}

module.exports = { getTranscriptUpTo, getFullTranscript, CALL_SCRIPT, SALES_REP, PROSPECT };
