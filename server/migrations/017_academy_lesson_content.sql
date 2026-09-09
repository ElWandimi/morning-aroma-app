-- Real, downloadable lesson body content for a complete vertical slice of 3 courses (Espresso,
-- Home Brewing, Roasting Fundamentals) -- these 21 chapters already have real titles,
-- descriptions, and quizzes (see 014/015); this adds the actual full lesson text used to
-- generate a real downloadable PDF per lesson. The remaining 52 chapters have no content yet;
-- admins can add it through the chapter edit form's new Content field.

ALTER TABLE chapters ADD COLUMN IF NOT EXISTS content TEXT;

UPDATE chapters SET content = CASE id
  WHEN 'espresso-ch1' THEN 'A shot of espresso is defined by three numbers: dose, yield, and time. Dose is the weight of dry coffee grounds you put into the portafilter basket -- typically 18 to 20 grams for a standard double basket. Yield is the weight or volume of liquid espresso that comes out. Time is how long the shot takes to pull, usually somewhere between 25 and 35 seconds.

A "ratio" recipe, like 1:2, means the yield is twice the dose -- 18 grams in, 36 grams out. This single number tells you far more about a shot than "a double espresso" ever could, because it''s specific and repeatable. Two baristas using the same ratio on the same bean should land in the same neighborhood of flavor, even on different machines.

The reason this matters: espresso has almost no room for vagueness. A drip coffee brewed a little too weak or too strong is still drinkable. An espresso shot pulled 20% off its target ratio can taste completely different -- thin and sour, or muddy and bitter. Learning to think in dose, yield, and time, rather than "however long it takes," is the real starting point for every other skill in this course.'
  WHEN 'espresso-ch2' THEN 'Grind size controls how much resistance water meets as it passes through the coffee bed -- and resistance is what gives espresso time to actually extract flavor. Too coarse, and water rushes through in 15 seconds flat, pulling out mostly acids and leaving sugars and body behind. That shot tastes sour and thin. Too fine, and water can barely push through at all, over-extracting bitter compounds from the coffee and choking the machine.

Here''s the practical rule: if your shot runs fast and tastes sour, grind finer. If it runs slow and tastes bitter or harsh, grind coarser. This is the single most useful troubleshooting habit in espresso -- taste first, then adjust grind, not the other way around.

Grind adjustments on most grinders are small increments, and espresso is sensitive enough that even one or two "clicks" can noticeably change a shot. Make one change, pull one shot, taste it, and only then decide whether to adjust further. Chasing multiple variables at once is the most common reason people struggle to dial in a new bag of coffee.'
  WHEN 'espresso-ch3' THEN 'Every new bag of coffee needs its own dial-in, because grind, dose, and time interact differently depending on the bean''s roast level, freshness, and density. The process is the same every time: start from a sane baseline (an 18g dose, roughly a 1:2 ratio, aiming for 25-30 seconds), pull a shot, and taste it.

The discipline is changing only one variable between attempts. If a shot tastes sour, adjust grind finer and pull again -- don''t also change the dose at the same time. If you change two things at once and the next shot tastes different, you have no way of knowing which change actually caused it.

A useful habit: keep a small note of what you changed and what happened, even just mentally for the session. "Finer grind, still sour" tells you to keep going in that direction. "Finer grind, now bitter" tells you you''ve gone too far and need to back off slightly. Three or four thoughtful adjustments, tasted carefully, will get most beans dialed in -- far fewer than randomly changing settings and hoping.'
  WHEN 'espresso-ch4' THEN 'Distribution is how evenly coffee grounds are spread across the basket before tamping. It sounds like a minor detail, but it''s one of the most common causes of an inconsistent or bad-tasting shot, even from someone who tampers carefully.

Here''s why it matters: water always takes the path of least resistance. If one side of the puck is denser than the other -- because grounds were mounded unevenly before tamping -- water will punch through the thinner, lower-resistance side first. This is called channeling. The result is a shot that''s simultaneously over-extracted (in the channel, where water rushed through and stripped bitter compounds) and under-extracted (everywhere else, where water barely touched the grounds).

A tamp, no matter how firm or level, cannot fix uneven distribution underneath it -- it just presses an already-uneven bed into a flat-looking top that hides the problem. Whether you distribute by hand, with a distribution tool, or by tapping the portafilter, the goal is the same: an evenly dense bed of grounds from edge to edge before the tamp ever touches it.'
  WHEN 'espresso-ch5' THEN 'Watching the pour is one of the most useful diagnostic habits you can build, because a shot tells you what''s happening inside the puck in real time, before you ever taste it.

A healthy pour usually starts slow and dark, thickening into a steady stream with real body -- often described as looking like warm honey. As the shot continues, it should gradually lighten in color as the extractable flavor compounds are used up, and you generally want to stop the shot before it turns pale and thin, since that''s mostly water passing through spent grounds at that point.

A pour that starts pale and thin from the very beginning, or that thins out unusually fast, is a strong sign of channeling -- water has found an easy path through the puck and is rushing through with far less resistance than it should. A pour that never really flows, coming out in fits and starts or not at all, usually means the grind is too fine or the dose is packed too tight. Learning to read these signs lets you catch a bad shot before you''ve wasted time tasting it.'
  WHEN 'espresso-ch6' THEN 'Bitterness and harshness in espresso usually come from one (or a combination) of a few real causes, and it''s worth checking through them systematically rather than guessing.

Over-extraction is the most common: grind too fine, or time too long, pulls out compounds that are naturally bitter and only dissolve later in the extraction. The fix is usually a coarser grind or a shorter shot.

The coffee itself is the second most common cause. A very dark roast will taste more bitter almost by design, since roasting itself produces bitter compounds the longer and hotter it goes. Stale coffee -- roasted weeks or months ago, or ground long before brewing -- also tends to taste flatter and harsher, since the more delicate, pleasant flavor compounds fade first while the harsher ones remain.

Less commonly, water that''s too hot, or a machine with a genuine equipment issue (a scaled-up boiler, a worn seal), can push a shot toward harshness too. But before assuming it''s the machine, it''s worth ruling out grind and freshness first -- they''re the more common, and more fixable, culprits.'
  WHEN 'home-brewing-ch1' THEN 'Pour-over, French press, and Aeropress each brew coffee through a different mechanism, and picking between them is really about matching a method to how you actually want your morning to go, not finding one objectively "best" brewer.

Pour-over (V60, Chemex, Kalita) gives you the most control and typically the clearest, brightest cup, but it demands your attention for the full brew -- you''re pouring in stages, watching the bed, timing things. It rewards patience and a slower morning.

French press is immersion brewing: grounds steep fully in water for several minutes before being pressed through a metal mesh. It''s far more forgiving of imprecise technique, produces a fuller-bodied cup, and needs almost no attention during the steep -- but cleanup involves separating spent grounds from a heavier vessel.

Aeropress splits the difference: quick, portable, and fairly forgiving, with a shorter brew time than either of the other two, at the cost of a smaller single-serving batch size.

There''s no wrong choice here. The right one is whichever method you''ll actually enjoy using regularly.'
  WHEN 'home-brewing-ch2' THEN 'The same bag of coffee needs a meaningfully different grind size depending on which method you''re brewing it with, and the reason comes down to contact time and filtration.

Pour-over uses a medium grind and a paper filter, with total contact time usually under four minutes -- fine enough to extract properly in that window, but not so fine that water can''t flow through at a reasonable pace.

French press needs a noticeably coarser grind. Grounds sit in full contact with water for four minutes or more with no paper filter at all -- only a metal mesh, which lets fine particles and oils through. A grind too fine for French press over-extracts badly in that much contact time and leaves a muddy, sediment-heavy cup.

Aeropress sits in between, often closer to a fine drip grind, since brew times are typically under two minutes and a paper or metal filter is used depending on the method variant.

If a cup tastes consistently over- or under-extracted despite reasonable technique, grind size mismatched to the method is one of the first things worth checking.'
  WHEN 'home-brewing-ch3' THEN 'The "bloom" is the first, small pour in pour-over brewing -- just enough hot water to wet all the grounds, usually about twice the weight of the dry coffee, held for 30 to 45 seconds before the main pour begins.

Freshly roasted coffee holds a surprising amount of trapped carbon dioxide, a byproduct of roasting. When hot water first hits dry grounds, that CO2 escapes rapidly -- you''ll see the coffee bed visibly puff up and bubble. If you pour straight into that outgassing without a bloom first, the escaping gas pushes water away from the grounds unevenly, causing patchy, inconsistent saturation for the rest of the brew.

Blooming lets most of that initial CO2 release happen before the real extraction starts, so the following pours saturate the grounds evenly rather than fighting bubbles and channels the whole way through. It''s a small step, but skipping it is one of the more common reasons a pour-over brew tastes uneven or underwhelming despite otherwise careful technique.'
  WHEN 'home-brewing-ch4' THEN 'French press coffee has a noticeably fuller, heavier mouthfeel than paper-filtered methods, and that difference comes down entirely to what the filter does and doesn''t remove.

Paper filters are fine enough to trap coffee oils and the finest particles of ground coffee (called "fines"), letting through only the clear liquid. That''s why pour-over and drip coffee tend to look and taste clean and bright.

French press uses a metal mesh instead, which is far coarser. Oils pass straight through into the cup, along with a meaningful amount of fine sediment. Those oils carry flavor compounds and contribute directly to the sensation of body -- the coffee feels heavier and richer on the tongue, sometimes described as syrupy or full.

The tradeoff is that fine sediment settles at the bottom of the cup as you drink, which is why French press coffee often has a slightly gritty last sip. That''s not a flaw to fix; it''s simply the nature of the method -- the same oils that give French press its body are exactly what a paper filter would otherwise strip out.'
  WHEN 'home-brewing-ch5' THEN 'Aeropress has two common approaches -- standard and inverted -- and the real difference between them is when filtration begins relative to steeping.

In the standard method, the Aeropress sits filter-side-down over your cup from the start, meaning water is already trickling through the filter for the entire brew. In the inverted method, the Aeropress is flipped upside down, filter-side-up, so no water can escape during the steep -- you add the filter cap and flip it right-side-up only at the very end, just before pressing.

This gives inverted brewing more control over total contact time, since nothing drains until you choose to flip and press. It''s a small mechanical difference, but it changes how directly you can control steep time versus letting gravity do some of the work throughout.

Neither method is strictly better -- standard is simpler and has less room for a spill during the flip, while inverted gives more precise timing. Many people settle on whichever one they started with; both make genuinely good coffee.'
  WHEN 'home-brewing-ch6' THEN 'It''s easy to assume "just use tap water" and not think about it further, but water chemistry has a real, measurable effect on how coffee tastes -- often more than people expect.

Coffee extraction depends partly on the minerals dissolved in your brewing water, particularly calcium and magnesium. Water with too few minerals (very soft, or distilled water) extracts poorly and often tastes flat and underwhelming, even with otherwise good technique, because there''s not enough mineral content to properly draw out flavor compounds from the grounds. Water that''s very hard, with excess minerals, can extract too aggressively or leave a chalky, mineral aftertaste, and contributes to scale buildup in brewing equipment over time.

You don''t need a home water lab to benefit from this -- if your tap water tastes noticeably off on its own (strongly of chlorine, very hard, or very soft), that''s a reasonable signal it''s affecting your coffee too. A basic filter often solves most of the problem. Water temperature matters separately: too cool under-extracts, too close to boiling can scald delicate flavors, with roughly 195-205°F (90-96°C) being the generally recommended range.'
  WHEN 'home-brewing-ch7' THEN 'The value of a repeatable routine isn''t about rigidly doing the exact same thing forever -- it''s that consistency gives you a reliable baseline to actually notice what a change does.

If you brew with wildly different grind sizes, ratios, and timings every morning, and one day the coffee tastes better or worse, you have no way to know why. Was it the beans? The water? The grind? Without a consistent starting point, cause and effect get lost in the noise.

A simple, repeatable home routine -- the same rough ratio, the same grind setting for your grinder, the same brew method most days -- turns your daily coffee into a small, ongoing experiment. When you try a new bag of beans, you''ll actually be able to tell how it differs from what you''re used to. When you deliberately adjust one variable, you''ll be able to taste what that specific change did.

This doesn''t mean never varying your routine -- it means having a default you can return to, so any change you make is a deliberate comparison against something familiar, not just another random data point.'
  WHEN 'roasting-fundamentals-ch1' THEN 'Green, unroasted coffee is dense, grassy-smelling, and essentially unbrewable in any way that tastes good. Roasting is what transforms it into the aromatic, soluble coffee we actually drink -- and understanding broadly what happens inside the bean helps everything else in this course make more sense.

As beans heat, they first lose moisture (green coffee is roughly 10-12% water by weight). Once enough moisture is gone, the beans begin actual pyrolysis -- a cascade of chemical reactions, most notably the Maillard reaction (the same browning reaction responsible for seared meat and toasted bread) and caramelization of the bean''s natural sugars. These reactions are what create the hundreds of aromatic compounds responsible for coffee''s flavor and smell; green coffee simply doesn''t contain them yet.

Physically, the bean also changes shape: it expands significantly in size (sometimes 50-100% by volume), changes from a dense grey-green to progressively browner colors, and its structure becomes measurably more porous and brittle as internal gases build up and press outward. All of this is why roasting isn''t just "toasting until brown" -- it''s a real, complex transformation with distinct, learnable stages.'
  WHEN 'roasting-fundamentals-ch2' THEN 'First crack is a real, physical, audible event -- not a metaphor. As beans roast and internal pressure builds from steam and expanding gases, the bean''s cell structure eventually reaches a breaking point and audibly cracks, producing a sound often compared to popcorn popping, though quieter and sharper.

This matters enormously to roasters because it''s a genuinely objective marker, unlike color (which is harder to judge consistently) or smell (which varies by roaster and environment). Nearly every roast profile is described relative to first crack -- "roasted 90 seconds past first crack" is a precise, repeatable instruction in a way "roasted until medium brown" isn''t.

First crack typically begins somewhere in the 385-405°F (196-207°C) range depending on the bean and roast style, though the exact temperature varies. It''s not instantaneous -- it happens as a rolling series of cracks over roughly 30-90 seconds, not one single pop. Some very light roasts are stopped right around first crack; most everyday roasts continue somewhat past it. A second, different-sounding crack occurs later, at much higher temperatures, marking the entry into dark roast territory.'
  WHEN 'roasting-fundamentals-ch3' THEN 'The period after first crack -- called development time -- is where a disproportionate amount of a roast''s final flavor character gets shaped, which is why roasters pay close attention to it specifically, not just total roast time.
  
Development time is usually expressed as a percentage of the total roast (development time ratio), commonly somewhere in the 15-25% range for most roast styles, though this varies by intent. Too little development -- pulling the beans very soon after first crack -- tends to leave a roast tasting underdeveloped: grassy, sour, or "baked" in an unpleasant way, even if the total roast time seems reasonable.

Too much development, on the other hand, pushes flavor further away from the bean''s origin character and toward generic "roasty" flavors -- and taken far enough, toward burnt or ashy notes as sugars fully caramelize and then char.

This is part of why two roasts that hit the same final temperature can taste completely different: if one spent 15% of its time post-crack and another spent 30%, the chemistry happening in that window diverges significantly, even with an identical endpoint.'
  WHEN 'roasting-fundamentals-ch4' THEN 'A roast curve plots bean temperature against time throughout the roast, and reading it well is one of the most useful diagnostic skills a roaster develops -- because the curve reveals problems that color or smell alone might not catch until it''s too late to fix.

A healthy curve generally shows a steadily decreasing rate of temperature rise as the roast progresses -- fast increases early on, gradually slowing as the roast approaches and passes first crack. This is expected and normal.

A "stall" or flat spot is different: it''s a point where the rate of rise drops off far more than expected, or temperature briefly plateaus, indicating the heat currently being applied isn''t keeping pace with what the bean needs at that stage. Left uncorrected, a stall commonly leads to a "baked" roast -- one that spent too long in a narrow temperature range without enough forward momentum, producing a flat, papery, underdeveloped cup even if the final temperature looks correct.

Roasters watch for early signs of a stall and respond by increasing applied heat before it becomes a real flat spot -- reading the curve in real time, not just reviewing it afterward, is what separates a roast that''s actively managed from one that''s just left to run.'
  WHEN 'roasting-fundamentals-ch5' THEN 'It''s tempting to think of roast level as a single dial from "weak" to "strong," with darker automatically meaning more flavor. That''s not really how it works -- roast level trades off different characteristics against each other rather than simply adding more of everything.

Lighter roasts, stopped closer to first crack, tend to preserve more of a coffee''s origin character: the specific fruit, floral, or acidic notes that come from where and how the bean was grown and processed. They also tend to have brighter acidity and lighter body.

Darker roasts push further past first crack (sometimes into or through second crack), and roast-driven flavors -- caramelized sugar, toasted, sometimes smoky or bittersweet notes -- increasingly dominate over the bean''s original character. Acidity drops noticeably, and body typically increases, partly due to roast oils migrating to the bean''s surface.

Neither is objectively better. A naturally bright, fruity Ethiopian coffee roasted very dark loses much of what made it distinctive in the first place; a naturally heavy, low-acid coffee roasted very light can taste thin or underdeveloped. Matching roast level to the bean''s own characteristics, and to what a drinker actually wants from the cup, matters more than chasing "darker equals bolder."'
  WHEN 'roasting-fundamentals-ch6' THEN 'Freshly roasted coffee isn''t actually at its best the moment it comes out of the roaster, which surprises people expecting "fresher is always better."

Beans continue releasing carbon dioxide for days after roasting -- a process called degassing, most intense in the first 24-48 hours and gradually tapering off over roughly one to two weeks depending on roast level (darker roasts, being more porous, tend to degas faster). This trapped CO2 causes real, measurable brewing problems if beans are used too soon: an oversized, uneven bloom in pour-over brewing, inconsistent extraction as gas pushes water away from grounds unpredictably, and often a flatter, less balanced flavor than the same beans would show a few days later.

A common resting window is somewhere between 3 and 10 days post-roast, though this varies by roast level and brew method -- espresso in particular often benefits from a few extra days of rest compared to drip methods, since the pressurized brewing process is especially sensitive to excess CO2.

This is also why "roasted today" isn''t actually the selling point it sounds like -- coffee genuinely tastes better after a short, deliberate rest than immediately off the roaster.'
  WHEN 'roasting-fundamentals-ch7' THEN 'A "baked" roast is one of the more common faults home and small-batch roasters run into, and it produces a distinctly flat, papery, sometimes cardboard-like cup that can be hard to diagnose if you don''t know what caused it.

The typical cause is applying too little heat over too long a roast time -- often from an early stall (see the previous lesson) that goes uncorrected, or simply starting with heat set too low and never adjusting upward to compensate. The bean spends an extended period in a narrow temperature range without enough forward momentum, and the chemical reactions responsible for real flavor development (the Maillard reaction and caramelization) don''t proceed as vigorously as they should.

The result tastes underdeveloped despite the total roast time being, in some cases, longer than a well-executed roast -- which is counterintuitive and part of why baking is a tricky fault to self-diagnose. A baked roast isn''t necessarily under-roasted by color; it can look like a normal medium roast while tasting flat and lifeless.

The fix is generally roasting with a more assertive, front-loaded heat application, and watching the curve actively (see lesson 4) to catch and correct a stall before it turns into a fully baked roast.'
  WHEN 'roasting-fundamentals-ch8' THEN 'A roast log is simply a written record of what you actually did during a roast -- charge temperature, heat adjustments and when you made them, first crack time and temperature, total roast time, drop temperature -- kept consistently, roast after roast.

The value is straightforward but easy to underestimate: without a record, a genuinely great roast is nearly impossible to repeat reliably, because you''re relying on memory of decisions made in the moment, under time pressure, roast after roast. With a log, you can look back and see exactly what you did differently the time it turned out well.

The same applies in reverse for a bad roast -- a log lets you actually diagnose what went wrong (a late heat increase, a longer-than-usual stall, an unusually short development time) instead of guessing after the fact.

Over time, a log also reveals patterns specific to your own equipment and beans that generic advice can''t tell you -- how a particular bean tends to behave, what heat settings your specific roaster needs at each stage. This is less about any single roast and more about building a body of real, personal reference data you can actually trust and return to.'
  ELSE content
END
WHERE id IN ('espresso-ch1', 'espresso-ch2', 'espresso-ch3', 'espresso-ch4', 'espresso-ch5', 'espresso-ch6', 'home-brewing-ch1', 'home-brewing-ch2', 'home-brewing-ch3', 'home-brewing-ch4', 'home-brewing-ch5', 'home-brewing-ch6', 'home-brewing-ch7', 'roasting-fundamentals-ch1', 'roasting-fundamentals-ch2', 'roasting-fundamentals-ch3', 'roasting-fundamentals-ch4', 'roasting-fundamentals-ch5', 'roasting-fundamentals-ch6', 'roasting-fundamentals-ch7', 'roasting-fundamentals-ch8');
