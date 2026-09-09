# Music Licenses

Every audio file in `public/music/` is listed here with its source, licence and
attribution. Nothing here is redistributed without a licence permitting it.

> **"Free to listen to" is not "free to redistribute."** Only add tracks whose
> licence explicitly allows hosting and redistribution.

| | |
|---|---|
| Tracks | 16 |
| Running time | 53 min |
| Composer | Kevin MacLeod |
| Source | [incompetech.com](https://incompetech.com/music/royalty-free/music.html) |
| License | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Redistribution | Permitted, with attribution |
| Modification | Permitted (re-encoded to 128 kbps MP3 for the web) |

## Required attribution

CC BY 4.0 requires credit. It appears here, in the README, and in the app under
the library. If you fork this, keep it.

```text
Music by Kevin MacLeod (incompetech.com)
Licensed under Creative Commons: By Attribution 4.0
https://creativecommons.org/licenses/by/4.0/
```

## Tracks

| # | Track | Genre | Length | ISRC | Source |
|---|---|---|---|---|---|
| 1 | Whiskey on the Mississippi | Blues | 3:15 | USUAN1100709 | [link](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Whiskey%20on%20the%20Mississippi.mp3) |
| 2 | Fig Leaf Rag | Ragtime | 3:29 | USUAN1100701 | [link](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Fig%20Leaf%20Rag.mp3) |
| 3 | Olde Timey | Ragtime | 3:15 | USUAN1100126 | [link](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Olde%20Timey.mp3) |
| 4 | Barroom Ballet | Ragtime | 0:57 | USUAN1100310 | [link](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Barroom%20Ballet.mp3) |
| 5 | Hillbilly Swing | Bluegrass | 2:47 | USUAN1900032 | [link](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Hillbilly%20Swing.mp3) |
| 6 | Drankin Song | Folk | 4:06 | USUAN1500021 | [link](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Drankin%20Song.mp3) |
| 7 | Guts and Bourbon | Country Rock | 3:29 | USUAN1400032 | [link](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Guts%20and%20Bourbon.mp3) |
| 8 | Matt's Blues | Blues | 2:47 | USUAN1100165 | [link](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Matts%20Blues.mp3) |
| 9 | Southern Gothic | Southern Gothic | 2:27 | USUAN2300004 | [link](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Southern%20Gothic.mp3) |
| 10 | DarxieLand | Dixieland | 2:26 | USUAN1600059 | [link](https://incompetech.com/music/royalty-free/mp3-royaltyfree/DarxieLand.mp3) |
| 11 | Lost Frontier | Western | 4:25 | USUAN1300039 | [link](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Lost%20Frontier.mp3) |
| 12 | Neo Western | Western | 2:26 | USUAN1100615 | [link](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Neo%20Western.mp3) |
| 13 | River Valley Breakdown | Bluegrass | 6:09 | USUAN1300032 | [link](https://incompetech.com/music/royalty-free/mp3-royaltyfree/River%20Valley%20Breakdown.mp3) |
| 14 | Cattails | Folk | 2:39 | USUAN1100743 | [link](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Cattails.mp3) |
| 15 | Still Pickin | Bluegrass | 4:58 | USUAN1900033 | [link](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Still%20Pickin.mp3) |
| 16 | Fiddles McGinty | Celtic | 3:27 | USUAN1400051 | [link](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Fiddles%20McGinty.mp3) |

All by **Kevin MacLeod**, all **CC BY 4.0**.

## Cover artwork

Not third-party art — `scripts/generate.mjs` draws it, so it falls under this
repository's own [MIT license](LICENSE).

## Adding your own music

1. Drop the audio in `public/music/`.
2. Add an entry to `scripts/library.source.json`.
3. `npm run generate`, then apply `supabase/seed.sql`.
4. **Record the licence above.** No nameable redistribution licence, no track.

Good sources: [Incompetech](https://incompetech.com/music/royalty-free/music.html) (CC BY),
[Free Music Archive](https://freemusicarchive.org/), [Musopen](https://musopen.org/)
(public-domain classical), [ccMixter](http://ccmixter.org/), or your own recordings.
Never rip from Spotify, Apple Music or YouTube.
