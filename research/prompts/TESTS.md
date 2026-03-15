That's it. now I want a prompt for Composer 1.5. here is the thing - Cursor now has subagents feature when main agent launches subagent to delegate some tasks. It's well-documented here: https://cursor.com/docs/subagents (please read it).

Now here is what I want: main agent should not write tests, it should delegate writing tests to subagent, but not all at once. it should launch subagent for writing tests for a specific file - (if file contains multiple entities - tests can also contain multiple describe-s in that case). when subagent finishes I want the main agent to review the tests (yes, literally review them - meaning - read them and assess how well those tests are written, then run them) - if either tests are not good or some of them fail - re-launch subagent to fix them. then assess again, if tests good? relaunch another subagent to write tests for next file, and so on.

understood?
