-- Instructor photos (real upload capability, mirroring products.photo_url) and real learning
-- objectives for the 21 existing seeded lessons -- both public/marketing-facing fields, shown
-- before any paywall, unlike full lesson content which stays access-gated.

ALTER TABLE courses ADD COLUMN IF NOT EXISTS instructor_photo_url TEXT;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS objectives TEXT[];

UPDATE chapters SET objectives = CASE id
  WHEN 'espresso-ch1' THEN ARRAY['Explain what dose, yield, and time mean in an espresso recipe', 'Read a ratio like 1:2 and know what it tells you about a shot']
  WHEN 'espresso-ch2' THEN ARRAY['Identify whether a shot needs a finer or coarser grind based on how it tastes', 'Understand why grind is the first variable to adjust, not pressure or dose']
  WHEN 'espresso-ch3' THEN ARRAY['Dial in a brand-new bag of coffee using a repeatable, one-variable-at-a-time process', 'Avoid the most common mistake beginners make when dialing in']
  WHEN 'espresso-ch4' THEN ARRAY['Explain why uneven distribution causes channeling, even with a good tamp', 'Recognize the signs of a poorly distributed puck']
  WHEN 'espresso-ch5' THEN ARRAY['Read a shot''s pour to diagnose a problem before tasting it', 'Recognize what a healthy pour looks like from start to finish']
  WHEN 'espresso-ch6' THEN ARRAY['List the most common causes of bitterness and harshness in espresso', 'Rule out grind and freshness before suspecting equipment issues']
  WHEN 'home-brewing-ch1' THEN ARRAY['Compare pour-over, French press, and Aeropress by control, body, and time required', 'Choose the right method for your own morning routine']
  WHEN 'home-brewing-ch2' THEN ARRAY['Explain why grind size needs to change between brewing methods', 'Match grind size to contact time and filtration for a given method']
  WHEN 'home-brewing-ch3' THEN ARRAY['Explain what the bloom does and why it matters', 'Correctly time and pour a bloom before the main extraction']
  WHEN 'home-brewing-ch4' THEN ARRAY['Explain why French press has a fuller body than filtered methods', 'Understand the tradeoff between body and sediment in immersion brewing']
  WHEN 'home-brewing-ch5' THEN ARRAY['Compare standard and inverted Aeropress methods', 'Choose which Aeropress method fits your own brewing style']
  WHEN 'home-brewing-ch6' THEN ARRAY['Explain how water mineral content affects extraction', 'Recognize signs that your water may be affecting your coffee']
  WHEN 'home-brewing-ch7' THEN ARRAY['Explain why a consistent routine helps you evaluate changes', 'Build a repeatable baseline for your own home brewing']
  WHEN 'roasting-fundamentals-ch1' THEN ARRAY['Describe what happens physically and chemically to a bean during roasting', 'Explain why green coffee tastes nothing like roasted coffee']
  WHEN 'roasting-fundamentals-ch2' THEN ARRAY['Explain what first crack is and why it''s a reliable marker', 'Identify the typical temperature range where first crack begins']
  WHEN 'roasting-fundamentals-ch3' THEN ARRAY['Explain what development time is and why it shapes flavor', 'Understand the tradeoff between too little and too much development']
  WHEN 'roasting-fundamentals-ch4' THEN ARRAY['Read a roast curve to spot a stall before it becomes a problem', 'Explain what a flat spot on a curve usually means']
  WHEN 'roasting-fundamentals-ch5' THEN ARRAY['Explain what roast level actually trades off, rather than assuming darker means bolder', 'Match roast level to a bean''s own characteristics']
  WHEN 'roasting-fundamentals-ch6' THEN ARRAY['Explain why fresh-roasted coffee isn''t at its best immediately', 'Identify a reasonable resting window before brewing']
  WHEN 'roasting-fundamentals-ch7' THEN ARRAY['Identify the typical cause of a baked, flat-tasting roast', 'Distinguish a baked roast from a simply under-roasted one']
  WHEN 'roasting-fundamentals-ch8' THEN ARRAY['Explain why a roast log matters for repeatability', 'Start keeping a real log of your own roasts']
  ELSE objectives
END
WHERE id IN ('espresso-ch1', 'espresso-ch2', 'espresso-ch3', 'espresso-ch4', 'espresso-ch5', 'espresso-ch6', 'home-brewing-ch1', 'home-brewing-ch2', 'home-brewing-ch3', 'home-brewing-ch4', 'home-brewing-ch5', 'home-brewing-ch6', 'home-brewing-ch7', 'roasting-fundamentals-ch1', 'roasting-fundamentals-ch2', 'roasting-fundamentals-ch3', 'roasting-fundamentals-ch4', 'roasting-fundamentals-ch5', 'roasting-fundamentals-ch6', 'roasting-fundamentals-ch7', 'roasting-fundamentals-ch8');
