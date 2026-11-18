# TabDungeon presentation script

## Opening

“TabDungeon is a Chrome side-panel study helper. Users create topic-based flashcard
decks, review cards when they are due, and can set an exam date. The pixel-art style is
kept as a visual theme.”

## Why the project changed

“The original idea classified websites as productive or distracting. That approach was
not appropriate because the same website can be useful or distracting depending on the
user and the specific page. A YouTube study lecture and a music video should not
automatically receive the same judgment.”

“The project was refocused on one narrower question: how related is the active page to
the topic of the user’s study deck?”

## Changes before the relevance classifier

“Before implementing the relevance classifier, we moved the product away from gameplay
and toward studying. The flashcard deck, due-review, SM-2 scheduling, exam-date handling,
settings, statistics, and simulation flows became the main features.”

“The dungeon gameplay elements such as HP, XP, inventory, and procedural rooms were
removed. The pixel-art visuals were retained as a themed interface.”

“The original domain and keyword classifier was kept only as an evaluation baseline. It
is not used by the normal extension runtime.”

## Current relevance classifier

“The classifier reads local page metadata such as the title, description, keywords, and
headings. It builds a TF-IDF model from the cards in a deck and compares the page with
the deck using cosine similarity.”

“It returns a score from zero to one and one of three labels: related, unrelated, or
uncertain. The thresholds are provisional and will be tuned using labeled data.”

“The scorer is deterministic, local, and callable from the extension, Node tests, and
the simulation. It does not send page text over the network.”

## Demonstration

1. Open the side panel and create a study deck.
2. Add cards about one topic.
3. Open a page related to that topic in the active tab.
4. Run the simulation or evaluator to show the score, label, and evaluation metrics.
5. Review a due card and explain that related exposure can add capped credit for the next
   successful review.
6. Show that an exam date can cap the scheduled interval.

## Closing

“TabDungeon does not claim that a website is universally good or bad. It measures page
relatedness for a particular study context. The evaluation uses human labels, while the
simulation demonstrates feasibility and does not by itself prove memory benefits.”
