# Symphony Language — Formal Grammar

**Status:** Draft v0.1. Authoritative source for the lexical and syntactic structure of the language. Semantics — name resolution, type inference, reactive propagation, evaluation order — are out of scope for this document and live in a separate semantics specification.

---

## 1. Conventions

### 1.1 Metalanguage

Productions are EBNF with the following operators:

| Form          | Meaning                              |
| ------------- | ------------------------------------ |
| `Foo := ...`  | Production definition                |
| `'literal'`   | Terminal: literal character sequence |
| `UPPERCASE`   | Terminal: token defined by lexer     |
| `PascalCase`  | Non-terminal production              |
| `A B`         | Concatenation                        |
| `A \| B`      | Alternation                          |
| `A?`          | Zero or one                          |
| `A*`          | Zero or more                         |
| `A+`          | One or more                          |
| `( A )`       | Grouping                             |
| `-- text`     | Comment within productions           |

Each production is one rule. Where multiple alternatives exist, they are written one per line, prefixed by `|`.

### 1.2 Layout

The language is indent-sensitive. The lexer emits three layout-significant tokens between source tokens:

- `NEWLINE` — end of a logical line, indent unchanged
- `INDENT`  — indent level increased relative to the previous logical line
- `DEDENT`  — indent level decreased; emitted once per dedent step

Inside paired delimiters `(...)`, `[...]`, layout tokens are suppressed. This permits free continuation of multi-line argument lists, generics, and tuples without indent constraints. Layout resumes at the matching closer.

Productions throughout this document refer to these tokens by name.

---

## 2. Lexical Grammar

### 2.1 Source Encoding

Source text is UTF-8. Byte-order marks are not permitted.

### 2.2 Whitespace and Indentation

```
HSPACE       := ' '              -- only the ASCII space is significant indentation
INLINE_WS    := ' ' | '\t'       -- horizontal whitespace inside a line
LINE_END     := '\n' | '\r\n'
```

Tabs are forbidden as leading indentation; a tab in the leading-whitespace region of a non-empty line is a lexical error. Tabs inside a line (between tokens) are treated as whitespace. Trailing whitespace before `LINE_END` is discarded.

The first non-empty line of a file establishes indent level 0. The lexer tracks an indent stack. For each new logical line:

- If indent matches the top of stack, emit `NEWLINE`.
- If indent exceeds the top of stack, push the new indent and emit `NEWLINE` then `INDENT`.
- If indent is below the top of stack, pop entries until a match is found, emitting `DEDENT` per pop, then emit `NEWLINE`. If no match exists, the indent is inconsistent and this is a lexical error.

Blank lines (empty or whitespace-only) and comment-only lines do not affect the indent stack.

At end of file, the lexer emits `DEDENT` for every remaining non-zero entry on the indent stack, followed by a final `NEWLINE`.

### 2.3 Comments

```
LineComment  := '//'  any-char-except-LINE_END *
DocComment   := '///' any-char-except-LINE_END *
```

Line comments extend from `//` to end of line and are discarded by the lexer.

Doc comments (`///`) are preserved as a structured token attached to the immediately following declaration. Multiple consecutive `///` lines associate as a single doc-comment block. There is no block-comment form.

### 2.4 Identifiers and Keywords

```
Ident        := IdentStart IdentCont*
IdentStart   := UnicodeLetter | '_' | '#'
IdentCont    := IdentStart | UnicodeDigit
```

`UnicodeLetter` is any character with Unicode property `Letter`. `UnicodeDigit` is any character with property `Decimal_Number`.

The character `#` is a valid identifier character at any position. This permits, e.g., `C#`, `F#7`, `lang#beta` as single identifiers in domain-specific contexts.

The character `?` is **not** a valid identifier character; it is exclusively the postfix Try operator and a flag character (see §2.6).

#### 2.4.1 Reserved Keywords

The following are reserved and cannot be used as identifiers:

```
Construct:       node  type  enum  trait  connection  fn
Reactive:        signal  derived  attr
Composition:     parts  in  out  from  to
Conformance:     satisfies  requires  where
Visibility:      pub
Imports:         use  as  extend  root
Self-reference:  Self  self
Type:            dyn  alias
Bindings:        let
Control:         if  else  match
Logical:         and  or  not  is
Literal:         true  false
```

The contextual identifier `index` is **not** reserved; it has meaning only in module-resolution rules (see §3.2).

### 2.5 Literals

#### 2.5.1 Integer Literals

```
IntLit       := IntPart IntSuffix?
IntPart      := DecInt | HexInt | OctInt | BinInt
DecInt       := DecDigit (DecDigit | '_')*
HexInt       := '0x' HexDigit (HexDigit | '_')*
OctInt       := '0o' OctDigit (OctDigit | '_')*
BinInt       := '0b' BinDigit (BinDigit | '_')*

DecDigit     := '0'..'9'
HexDigit     := DecDigit | 'a'..'f' | 'A'..'F'
OctDigit     := '0'..'7'
BinDigit     := '0' | '1'

IntSuffix    := 'i8' | 'i16' | 'i32' | 'i64' | 'i128' | 'isize'
              | 'u8' | 'u16' | 'u32' | 'u64' | 'u128' | 'usize'
              | 'int'
```

Underscores are visual separators ignored by the lexer. They may appear between digits but not at the start, end, or adjacent to the radix prefix (`0x`, `0o`, `0b`).

#### 2.5.2 Float Literals

```
FloatLit     := DecInt '.' DecInt FloatExp? FloatSuffix?
              | DecInt FloatExp FloatSuffix?
              | DecInt FloatSuffix          -- only when suffix forces float type

FloatExp     := ('e' | 'E') ('+' | '-')? DecInt
FloatSuffix  := 'f32' | 'f64' | 'number'
```

A float literal must be disambiguable from an integer literal: it must contain a `.` followed by digits, or an exponent, or an explicit float suffix. Bare `1` is integer; `1.0`, `1e5`, `1f32` are float.

A leading `.` (e.g. `.5`) is not permitted; write `0.5`.

#### 2.5.3 Boolean Literals

```
BoolLit      := 'true' | 'false'
```

#### 2.5.4 Character and Byte Literals

```
CharLit      := "'" CharBody "'"
ByteLit      := "b'" ByteBody "'"

CharBody     := UnicodeScalarChar | EscapeSeq
ByteBody     := AsciiPrintable    | EscapeSeq

EscapeSeq    := '\' EscapeSpec
EscapeSpec   := 'n' | 'r' | 't' | '0' | '\\' | "'" | '"' | '{'
              | 'x' HexDigit HexDigit
              | 'u' '{' HexDigit{1,6} '}'
```

`CharLit` produces a value of type `char` (a Unicode scalar value, 32-bit, range `0..=0x10FFFF` excluding surrogates).

`ByteLit` is restricted to ASCII printable characters or escape sequences and produces a value of type `u8`.

`UnicodeScalarChar` is any Unicode scalar value other than `'`, `\`, or unescaped `LINE_END`.

#### 2.5.5 String Literals

```
StringLit    := PlainString | RawString

PlainString  := '"' StringPart* '"'
StringPart   := PlainStringChar | EscapeSeq | Interpolation
PlainStringChar := UnicodeScalar except '"' or '\' or unescaped '{'

RawString    := 'r"' RawStringChar* '"'
              | 'r#"' RawStringChar* '"#'
              | 'r##"' RawStringChar* '"##'
              -- additional `#` levels permitted symmetrically

RawStringChar := UnicodeScalar except the matching '"' (with `#`-padding)

Interpolation := '{' Expr '}'
```

**Plain strings** (`"..."`) may contain literal newlines; embedded newlines become part of the string. `\n`, `\r`, `\t`, `\0`, `\\`, `\"`, `\'`, `\{`, `\xHH`, `\u{HHHHHH}` are recognized escapes. `\{` produces a literal `{` and disables interpolation at that position.

**Interpolation** (`{expr}`) evaluates `expr` and converts to string via the `Display` trait. Nested string literals are allowed inside interpolation expressions.

**Raw strings** (`r"..."`, `r#"..."#`, …) perform no escape processing and no interpolation. All characters are literal. The `#`-padding form lets the literal contain `"`: `r#"contains "quotes""#`.

#### 2.5.6 Duration Literals

```
DurationLit  := DurationNumber DurationUnit
DurationNumber := IntPart | (DecInt '.' DecInt)
DurationUnit := 'ns' | 'us' | 'ms' | 's' | 'min' | 'hr'
```

Duration literals produce values of stdlib type `Duration`. They are not numeric — there is no implicit conversion to or from `Duration` and integer/float types.

The lexer recognizes a duration literal only when the unit suffix is immediately adjacent (no whitespace) to the numeric part.

### 2.6 Operators and Punctuation

```
PUNCT_COLON      := ':'
PUNCT_SEMI       := ';'
PUNCT_COMMA      := ','
PUNCT_DOT        := '.'
PUNCT_AT         := '@'
PUNCT_PIPE       := '|'
PUNCT_LPAREN     := '('
PUNCT_RPAREN     := ')'
PUNCT_LBRACK     := '['
PUNCT_RBRACK     := ']'
PUNCT_ARROW      := '->'
PUNCT_DBLCOLON   := '::'
PUNCT_PIPEFWD    := '>>'
PUNCT_EQUALS     := '='

OP_PLUS          := '+'
OP_MINUS         := '-'
OP_STAR          := '*'
OP_SLASH         := '/'
OP_PERCENT       := '%'
OP_PLUS_PCT      := '+%'
OP_MINUS_PCT     := '-%'
OP_STAR_PCT      := '*%'
OP_PLUS_PIPE     := '+|'
OP_MINUS_PIPE    := '-|'
OP_STAR_PIPE     := '*|'
OP_LT            := '<'
OP_LE            := '<='
OP_GT            := '>'
OP_GE            := '>='
OP_AMP           := '&'
OP_QUESTION      := '?'
OP_BANG          := '!'
```

The lexer prefers the longest valid token. `+%` is one token, not `+` followed by `%`. `>>` is one token, not two `>`.

#### 2.6.1 Flag Characters

The following characters are valid as **flags** in placement context (immediately adjacent — no whitespace — to a type identifier in a placement position; see §3.10):

```
FlagChar     := "'" | '@' | '$' | '`' | '?' | '!' | '~' | '^' | '%' | '&'
```

In placement context, a flag is a single-character modifier that aliases a boolean attribute of the surrounding type. Outside placement context, each character carries its primary meaning:

- `'` is the character-literal delimiter
- `@` is the annotation prefix
- `?` is the postfix Try operator
- `!` is reserved for attribute-pipe negation (`| !attr`); it is otherwise unused as an operator
- `&` is type intersection
- `%` is the modulo operator
- `~`, `^`, `$`, `` ` `` have no other meaning and are reserved for flags only

Flags are tokenized as a contiguous run of `FlagChar`s adjacent to a preceding type identifier. Lexer sketch:

> When the lexer has just produced an identifier token whose first character is `IdentStart` and that identifier is followed (with no intervening whitespace) by one or more `FlagChar`s, those characters are emitted as a `FLAGS` token whose lexeme is the contiguous flag run.

This rule only fires in placement context, which is determined parsing-side; lexically, the rule is "ident immediately followed by flag chars produces a `FLAGS` token." Disambiguation of intent is the parser's responsibility.

### 2.7 Tokens Summary

The lexer produces the following token kinds:

```
NEWLINE  INDENT  DEDENT
IDENT  KEYWORD  FLAGS
INT_LIT  FLOAT_LIT  BOOL_LIT  CHAR_LIT  BYTE_LIT  STRING_LIT  DURATION_LIT
DOC_COMMENT
PUNCT_*  OP_*
EOF
```

---

## 3. Syntactic Grammar

### 3.1 Module

A source file is parsed as a `Module`.

```
Module       := ModuleItem*

ModuleItem   := UseItem
              | ExtendItem
              | DeclItem

DeclItem     := Annotation* DocComment? Decl

Decl         := SignalDecl
              | DerivedDecl
              | TypeDecl
              | EnumDecl
              | TraitDecl
              | NodeDecl
              | ConnectionDecl
              | FnDecl
              | NodeInstantiation       -- top-level named node instance
              | AliasDecl
```

Each `ModuleItem` is followed by a `NEWLINE`. The grammar does not represent these terminating newlines explicitly in productions below; they are implicit at item boundaries.

### 3.2 Imports

```
UseItem      := 'use' UsePath NEWLINE

UsePath      := PathBase ('::' PathSegment)* UseTail?
PathBase     := 'root' | Ident
PathSegment  := Ident
UseTail      := '::' UseGroup
              | '::' '*'
              | 'as' Ident

UseGroup     := '{' UseGroupItem (',' UseGroupItem)* ','? '}'
UseGroupItem := PathSegment ('::' PathSegment)* UseTail?
              | '*'
```

Examples:

```
use root::audio::synth::Oscillator
use root::audio::synth::{Oscillator, Filter}
use root::audio::synth::*
use root::audio::Pin as MusicPin
use root::core::{time, prior, Duration}
```

`PathBase` is `root` for absolute paths from the project root, the literal name of an external dependency for cross-package imports, or `Ident` referring to a sibling module in the current folder.

Files in the same folder are auto-visible to one another without `use`. Cross-folder visibility is gated by `pub` and routed through optional `index` files (see semantics document; not part of grammar).

### 3.3 Annotations

```
Annotation   := '@' Ident AnnotationArgs? NEWLINE
AnnotationArgs := '(' (AnnotationArg (',' AnnotationArg)* ','?)? ')'
AnnotationArg  := Expr
                | Ident ':' Expr
```

Annotations precede declarations and stack across lines. Examples:

```
@inline
@derive(Equal, Hash)
@deprecated("use new_compute instead")
fn old_compute() -> i32:
  ...
```

Annotation interpretation is compiler/tooling-defined; the grammar does not constrain which annotation names are valid.

### 3.4 Signal and Derived Declarations

```
SignalDecl   := Pub? 'signal' Ident TypeAnno? '=' Expr ModifierTail?
DerivedDecl  := Pub? 'derived' Ident TypeAnno? '=' Expr ModifierTail?

TypeAnno     := ':' TypeExpr

ModifierTail := NEWLINE INDENT ModifierLine+ DEDENT
ModifierLine := '>>' Ident ':' Expr NEWLINE

Pub          := 'pub'
```

The optional `ModifierTail` is sugar for read-side method composition, equivalent to wrapping the right-hand-side expression in chained `>>` calls. See §3.13 for desugaring.

`signal` declarations always carry an initial value. `derived` declarations are read-only; the compiler rejects any attempt to assign to a `derived` binding (assignment forms in user code are limited; see §3.4.1).

#### 3.4.1 Assignability

User code in `.symph` source has no syntactic form for assigning to a `signal`, `derived`, or `attr` after declaration. Signal mutation is performed by the runtime through its host-language API, not from within source. The grammar therefore contains no signal-write statement.

The token `=` appears only as:
- the initial-value separator in `signal`/`derived`/`attr`/`let` declarations
- the separator inside annotation arguments and generic defaults

### 3.5 Type Declarations

```
TypeDecl     := Pub? 'type' Ident GenericParams? TypeBody

TypeBody     := '=' TypeExpr NEWLINE                            -- alias / sum
              | NEWLINE INDENT TypeBodyItem+ DEDENT             -- record / extension

TypeBodyItem := SatisfiesClause
              | TypeFieldDecl
              | FnDecl
              | DocComment

TypeFieldDecl := Pub? Ident TypeAnno ('=' Expr)? NEWLINE

SatisfiesClause := 'satisfies' TypeExpr (',' TypeExpr)* NEWLINE
```

The `=` form covers two cases:

```
type Pitch = i8                       -- nominal newtype
type Direction = North | South | East | West   -- inline tagged sum, no payloads
```

The block form covers records and types with bodies:

```
type Vec3:
  x: f32
  y: f32
  z: f32

type Color:
  pub r: u8
  pub g: u8
  pub b: u8
  pub a: u8 = 255
  satisfies Equal, Hash
```

Sum types with payloads use `enum`, not `type` (see §3.6).

#### 3.5.1 Aliases

```
AliasDecl    := Pub? 'alias' 'type' Ident GenericParams? '=' TypeExpr NEWLINE
```

Example: `alias type CustomerContact = Contact`. Aliases introduce no new type identity; they are purely lexical.

### 3.6 Enum Declarations

```
EnumDecl     := Pub? 'enum' Ident GenericParams? EnumBody

EnumBody     := '=' VariantInline ('|' VariantInline)+ NEWLINE   -- inline form, payloads forbidden
              | NEWLINE INDENT EnumBodyItem+ DEDENT

EnumBodyItem := VariantDecl
              | SatisfiesClause
              | FnDecl
              | DocComment

VariantInline := Ident
VariantDecl  := Ident VariantPayload? NEWLINE

VariantPayload := '(' (VariantField (',' VariantField)* ','?)? ')'
VariantField   := Ident ':' TypeExpr     -- named payload field
                | TypeExpr               -- positional payload field
```

A variant's payload is either fully named or fully positional; mixing within one variant is a parse error.

Examples:

```
enum Direction = Up | Down | Left | Right

enum Event:
  KeyPress(key: String)
  Click(at: Vec3)
  Quit
  satisfies Debug

enum Result[T, E]:
  Ok(T)
  Err(E)
```

### 3.7 Trait Declarations

```
TraitDecl    := Pub? 'trait' Ident GenericParams? TraitBody

TraitBody    := NEWLINE INDENT TraitBodyItem+ DEDENT

TraitBodyItem := RequiresClause
               | AssocTypeDecl
               | TraitFnDecl
               | DocComment

RequiresClause := 'requires' TypeExpr (',' TypeExpr)* NEWLINE

AssocTypeDecl  := 'type' Ident GenericParams? ('=' TypeExpr)? NEWLINE

TraitFnDecl    := FnSignature (FnBody | NEWLINE)
                 -- with body: default implementation
                 -- without body: abstract method
```

Examples:

```
trait Add[Rhs = Self]:
  type Output
  fn add(self, other: Rhs) -> Output

trait Iterable:
  type Item
  fn next(self) -> Option[Item]

trait Student:
  requires Person
  attr school: String
  attr gpa: Number
```

> **Open**: `attr` declarations inside trait bodies — the conversation introduced these for capability declarations (`trait Notable: attr pitch: Pitch`). The grammar permits them via a uniform `TypeFieldDecl`/`AttrDecl` rule; final placement deferred to the semantics document.

### 3.8 Node Declarations

```
NodeDecl     := Pub? 'node' Ident GenericParams? NodeBody

NodeBody     := NEWLINE INDENT NodeDeclItem+ DEDENT

NodeDeclItem := SatisfiesClause
              | PartsClause
              | InClause
              | OutClause
              | AttrDecl
              | DerivedAttrDecl
              | FnDecl
              | DocComment

PartsClause  := 'parts' ':' TypeExpr (',' TypeExpr)* NEWLINE
InClause     := 'in'    ':' TypeExpr (',' TypeExpr)* NEWLINE
OutClause    := 'out'   ':' TypeExpr (',' TypeExpr)* NEWLINE

AttrDecl        := Pub? 'attr'    Ident TypeAnno ('=' Expr)? NEWLINE
DerivedAttrDecl := Pub? 'derived' Ident TypeAnno '=' Expr ModifierTail? NEWLINE
```

Example:

```
node Driver:
  satisfies Drivable, Insurable
  out: Drives, Owns
  attr expertise_level: i8
  attr risk_tolerance: f32 = 0.5
  derived skill_factor: f32 = self.expertise_level as f32 / 10.0

  fn aggressive(self) -> bool:
    self.risk_tolerance > 0.7
```

### 3.9 Connection Declarations

```
ConnectionDecl := Pub? 'connection' Ident GenericParams? ConnectionBody

ConnectionBody := NEWLINE INDENT ConnectionBodyItem+ DEDENT

ConnectionBodyItem := FromClause
                    | ToClause
                    | AttrDecl
                    | FnDecl
                    | DocComment

FromClause   := 'from' ':' TypeExpr NEWLINE
ToClause     := 'to'   ':' TypeExpr NEWLINE
```

Both `FromClause` and `ToClause` are required exactly once per connection declaration. Their absence or duplication is a parse error.

`from` and `to` are connection-defining structural slots; they are not regular `attr` declarations and follow distinct rules. The connection's `to` is the implicit default argument when the connection is invoked in placement context (see §3.10).

Example:

```
connection Drives:
  from: Driver
  to: Drivable
  attr enhanced_handling: bool
  attr aggressiveness: f32 = 0.5

connection Contains[T]:
  from: Container
  to: T
  attr index: usize
```

### 3.10 Placement (Construction in Node/Module Context)

Placement is the syntax used for instantiating nodes, parts, and connections. It is distinct from value construction (§3.13.4) and never appears in expression position.

```
NodeInstantiation := TypeRef Ident PlacementInline? PlacementBody?

PlacementForm := TypeRef Ident? PlacementInline? PlacementBody?

PlacementInline := DefaultArgPart? AttrPipe*

DefaultArgPart  := '/' Expr
AttrPipe        := '|' AttrPipeBody
AttrPipeBody    := Ident ':' Expr      -- set attribute to value
                 | Ident                -- set boolean attribute to true
                 | '!' Ident            -- set boolean attribute to false

TypeRef         := Path FLAGS?         -- type identifier with optional adjacent flags

PlacementBody   := ':' NEWLINE INDENT NodeBodyContent+ DEDENT

NodeBodyContent := AttrSetting
                 | PlacementForm        -- nested part / connection
                 | DocComment

AttrSetting     := Ident ':' Expr NEWLINE
```

`NodeInstantiation` is a top-level form; the bound `Ident` becomes a module-scope name for the instance.

`PlacementForm` is the recursive form used inside a node's body for parts, connections, and nested constructions. It permits an optional name (`Ident`); if absent, the part is anonymous.

`AttrSetting` (a bare `Ident ':' Expr` line) sets an attribute of the enclosing node instance. It is distinguished from a child `PlacementForm` by the `:` immediately after the leading identifier — `label: "B"` is an attr setting; `Pin out1` is a placement (no immediate colon).

#### 3.10.1 Disambiguation

Within a placement-body line, the parser commits to one of three forms by lookahead:

1. `Ident ':' Expr` → `AttrSetting`
2. `TypeRef Ident? PlacementInline?` (no `:` following the leading `TypeRef` directly, or `:` only at end-of-line introducing an indented body) → `PlacementForm`
3. Anything else in placement context is a parse error.

The first identifier on a line is checked: if it is followed by `:` and an expression on the same line, it is an attribute setting. Otherwise it is a `TypeRef` for a placement form.

#### 3.10.2 Examples

```
Driver john_doe:
  expertise_level: 10
  Drives/some_car | enhanced_handling: true | aggressiveness: 0.8

Component chip_b:
  label: "B"
  Pin out1
    WiresTo/chip_a.in1 | resistance: 50
    WiresTo/chip_a.in2 | resistance: 75
  Pin in1
  Pin'! pwr | direction: In
```

Inside `Component chip_b`'s body:
- `label: "B"` is an `AttrSetting`.
- `Pin out1` is a `PlacementForm` declaring a named part of type `Pin`.
- The two `WiresTo/...` lines under `Pin out1` are `PlacementForm`s declaring connections originating from `out1`.
- `Pin in1` is another part.
- `Pin'! pwr | direction: In` is a part of type `Pin` with one flag `!`, named `pwr`, with attribute `direction` set to `In`.

#### 3.10.3 Flag Tokenization in Placement

`FLAGS` is a lexer token produced when an identifier is followed without whitespace by one or more `FlagChar`s. Each character in the `FLAGS` lexeme is a separate flag, and each must alias a boolean `attr` declared on the type's trait closure. Flag-to-attr resolution is a semantic concern.

### 3.11 Function Declarations

```
FnDecl       := Pub? FnSignature FnBody

FnSignature  := 'fn' Ident GenericParams? FnParams ReturnType? WhereClause?

FnParams     := '(' (FnParam (',' FnParam)* ','?)? ')'
FnParam      := SelfParam
              | Ident ':' TypeExpr
SelfParam    := 'self'

ReturnType   := '->' TypeExpr

WhereClause  := 'where' WhereBound (',' WhereBound)*
WhereBound   := TypeExpr ':' TypeExpr ('+' TypeExpr)*

FnBody       := ':' BlockBody
              | ':' Expr NEWLINE       -- single-expression body
```

`SelfParam` is permitted only as the first parameter, only when the `fn` is declared inside a `type`/`enum`/`trait`/`node`/`connection` body. Top-level functions cannot use `self`.

`SelfParam` carries no type annotation; its type is `Self` (the enclosing type), passed by immutable reference. Mutation through `self` is forbidden.

In trait bodies, `FnBody` may be omitted (abstract method); see §3.7.

#### 3.11.1 Generic Parameters

```
GenericParams   := '[' GenericParam (',' GenericParam)* ','? ']'
GenericParam    := Ident GenericBound? GenericDefault?
                 | Ident ':' 'usize' GenericDefault?       -- value-generic over usize

GenericBound    := ':' TypeExpr ('+' TypeExpr)*
GenericDefault  := '=' (TypeExpr | Expr)
```

Examples:

```
fn average[T: Number](xs: Array[T]) -> T:
  ...

fn sort[T: Number + Ord](xs: Array[T]) -> Array[T]:
  ...

trait Add[Rhs = Self]:
  type Output
  fn add(self, other: Rhs) -> Output

type Buffer[T, N: usize = 1024]:
  data: Array[T, N]
```

`Array[T, N: usize]` declares a value-generic. The compiler treats `N` as a `usize` value, not a type, and distinguishes `Array[i32, 4]` from `Array[i32, 5]` as distinct types.

> **Open**: precise interaction between trait-bound `+` (multiple bounds) and `&` (intersection at use site). Currently `+` for declaration-site multi-bound on a single parameter; `&` for intersection at use sites. Document in semantics.

#### 3.11.2 Anonymous Functions

```
LambdaExpr   := 'fn' FnParams ReturnType? FnBody
```

Anonymous functions use the same shape as named ones, with the name omitted. They are permitted in any expression position. Multi-line bodies require enclosing parens (which suspend layout):

```
xs.map(fn(x): x * 2)

xs.map(fn(x):
  let doubled = x * 2
  doubled + 1
)
```

### 3.12 Extend Blocks

```
ExtendItem   := 'extend' TypeExpr ExtendBody

ExtendBody   := NEWLINE INDENT ExtendBodyItem+ DEDENT

ExtendBodyItem := SatisfiesClause
                | FnDecl
                | DocComment
```

`extend` adds methods and trait conformance to an existing type. It is the only mechanism by which the standard library declares trait conformance on primitives (`extend i32: satisfies Number, Equal, Ord`).

`extend` cannot add fields (`attr`, struct-field). It can only add methods and `satisfies` clauses. This restriction is grammatical: the body permits only `SatisfiesClause` and `FnDecl`.

### 3.13 Statements (Function Bodies)

```
BlockBody    := NEWLINE INDENT Stmt+ FinalExpr? DEDENT
              | NEWLINE INDENT FinalExpr DEDENT

Stmt         := LetStmt
              | ExprStmt
              | DocComment

LetStmt      := 'let' Pattern TypeAnno? '=' Expr StmtEnd
ExprStmt     := Expr StmtEnd
FinalExpr    := Expr NEWLINE

StmtEnd      := NEWLINE | ';'
```

A function body is a sequence of statements followed optionally by a final expression. The final expression is the function's return value. Without a final expression, the function returns the unit value `()`.

`;` is permitted as a same-line statement separator; it is interchangeable with `NEWLINE` for terminating a statement, though by convention statements are one per line.

#### 3.13.1 Let Bindings

```
LetStmt      := 'let' Pattern TypeAnno? '=' Expr StmtEnd
```

`let` is permitted only inside function bodies, anonymous function bodies, and pattern-arm bodies of `match`/`if`/`else`. It introduces an immutable lexical binding.

Pattern in `let` may be a destructuring pattern (tuple, record, enum variant); see §3.14.

### 3.14 Patterns

```
Pattern      := WildcardPat
              | LiteralPat
              | IdentPat
              | TuplePat
              | RecordPat
              | VariantPat
              | OrPat

WildcardPat  := '_'
LiteralPat   := IntLit | FloatLit | BoolLit | CharLit | StringLit
IdentPat     := Ident                       -- bind value to Ident

TuplePat     := '(' (Pattern (',' Pattern)* ','?)? ')'

RecordPat    := Path '(' (RecordPatField (',' RecordPatField)* ','?)? ')'
RecordPatField := Ident                     -- shorthand: bind field to same name
                | Ident ':' Pattern         -- destructure named field

VariantPat   := Path                        -- nullary variant
              | Path '(' (Pattern (',' Pattern)* ','?)? ')'
              | Path '(' (RecordPatField (',' RecordPatField)* ','?)? ')'

OrPat        := Pattern ('|' Pattern)+      -- only legal in match-arm position
```

Patterns appear in `let`, `match` arms, and function parameters of `match`-shaped destructuring (none yet defined; see open issues).

`OrPat` permits multiple patterns to share an arm body in `match`. All branches must bind the same set of identifiers with the same types.

#### 3.14.1 Pattern Guards

```
GuardedPattern := Pattern ('if' Expr)?
```

The `if`-guard is contextually allowed in `match` arms only.

### 3.15 Expressions

The expression grammar is presented from lowest to highest precedence. See §4 for the full table.

```
Expr         := OrExpr

OrExpr       := AndExpr ('or' AndExpr)*
AndExpr      := NotExpr ('and' NotExpr)*
NotExpr      := 'not' NotExpr
              | CmpExpr
CmpExpr      := PipeExpr (CmpOp PipeExpr)*
CmpOp        := 'is' 'not'
              | 'is'
              | '<=' | '>=' | '<' | '>'

PipeExpr     := AsExpr ('>>' Ident ':' AsExpr)*

AsExpr       := AddExpr ('as' TypeExpr)*

AddExpr      := MulExpr (AddOp MulExpr)*
AddOp        := '+' | '-' | '+%' | '-%' | '+|' | '-|'

MulExpr      := UnaryExpr (MulOp UnaryExpr)*
MulOp        := '*' | '/' | '%' | '*%' | '*|'

UnaryExpr    := '-' UnaryExpr
              | PostfixExpr

PostfixExpr  := PrimaryExpr Postfix*
Postfix      := '?'
              | '.' Ident
              | '.' IntLit                         -- tuple field access
              | '(' ArgList? ')'                   -- function call
              | '[' Expr ']'                       -- indexing

PrimaryExpr  := Literal
              | Path
              | 'self'
              | 'Self'
              | ParenOrTupleExpr
              | RecordExpr
              | LambdaExpr
              | IfExpr
              | MatchExpr
              | BlockExpr

Literal      := IntLit | FloatLit | BoolLit | CharLit | ByteLit | StringLit | DurationLit

Path         := PathBase ('::' PathSegment)*
ParenOrTupleExpr := '(' ')'                                  -- unit
                  | '(' Expr ')'                             -- parenthesized
                  | '(' Expr ',' ')'                         -- 1-tuple
                  | '(' Expr (',' Expr)+ ','? ')'            -- n-tuple

RecordExpr   := Path '(' (RecordExprField (',' RecordExprField)* ','?)? ')'
RecordExprField := Ident ':' Expr
                 | Expr                            -- positional, only when all fields are positional
                 | Ident                           -- shorthand: { x } means { x: x }

ArgList      := Arg (',' Arg)* ','?
Arg          := Ident ':' Expr                    -- named
              | Expr                              -- positional

BlockExpr    := ':' BlockBody                     -- only legal as RHS of certain forms
```

> **Note**: Comparison chaining (`a < b < c`) is not permitted; only one comparison per `CmpExpr` step. The `(CmpOp PipeExpr)*` in the grammar admits multi-step chains syntactically, but the type system rejects boolean-returning operands except on the last step. Final rule deferred to semantics.

#### 3.15.1 If/Else Expressions

```
IfExpr       := 'if' Expr ':' IfBody ElseTail
IfBody       := Expr                                -- single-line: `if a: b else: c`
              | NEWLINE INDENT Stmt+ FinalExpr? DEDENT
ElseTail     := 'else' ':' ElseBody
              | 'else' IfExpr                       -- else-if chain
ElseBody     := Expr
              | NEWLINE INDENT Stmt+ FinalExpr? DEDENT
```

`if` is always an expression. `else` is required when the `if` is in value-producing position (any expression context); the type system enforces this. A bare-statement `if` without `else` produces unit `()` and is permitted as `ExprStmt`.

Examples:

```
let m = if a > 0: a else: -a

let label = if status is Active:
  "active"
else if status is Pending:
  "pending"
else:
  "closed"
```

#### 3.15.2 Match Expressions

```
MatchExpr    := 'match' Expr ':' NEWLINE INDENT MatchArm+ DEDENT
MatchArm     := GuardedPattern ':' MatchArmBody
MatchArmBody := Expr NEWLINE
              | NEWLINE INDENT Stmt+ FinalExpr? DEDENT
```

Match is exhaustive over the scrutinee type. The compiler reports unreachable arms and missing variants.

```
match event:
  KeyPress(key): log("key: " + key)
  Click(at):
    move_cursor(at)
    register_hit(at)
  Quit: shutdown()

match n:
  0: "zero"
  m if m > 0: "positive"
  _: "negative"
```

#### 3.15.3 Pipe-Forward (`>>`)

```
PipeExpr     := AsExpr ('>>' Ident ':' AsExpr)*
```

`x >> name: arg` is sugar for `name(x, arg)`. Resolution of `name` follows ordinary method-name resolution: a method `name` reachable on the type of `x` (directly or via trait conformance) must exist.

Chains are left-associative: `x >> a: 1 >> b: 2` means `b(a(x, 1), 2)`.

Within a `signal`/`derived`/`attr` declaration, a `ModifierTail` (§3.4) is sugar over the same form, splitting the declaration into a hidden inner cell plus a derived projection. The exact desugaring is a semantics concern.

#### 3.15.4 Value Construction

```
RecordExpr   := Path '(' (RecordExprField (',' RecordExprField)* ','?)? ')'
```

Construction of `type` records and `enum` variant payloads uses parens with named or positional arguments:

```
Vec3(x: 1.0, y: 2.0, z: 3.0)
Vec3(1.0, 2.0, 3.0)
Some(42)
Click(at: Vec3(0.0, 0.0, 0.0))
```

Named and positional forms cannot be mixed within a single call. This is enforced at parse time.

Trailing commas are permitted but not required.

Multi-line construction is permitted inside the parens, with layout suspended:

```
Contact(
  name: "John",
  surname: "Doe",
  age: 25,
)
```

#### 3.15.5 Functional Update

```
WithExpr     := PostfixExpr 'with' '(' (RecordExprField (',' RecordExprField)* ','?)? ')'
```

> **Open**: `with` syntax for record functional update (`contact with(age: 26)`) was discussed but not pinned. Productions above show one candidate; alternative is `contact with age: 26 | name: "..."` using attribute pipes. Defer to semantics review.

### 3.16 Type Expressions

```
TypeExpr     := TypeIntersection

TypeIntersection := TypePostfix ('&' TypePostfix)*

TypePostfix  := TypeAtom TypePostfixOp*
TypePostfixOp := '[' TypeArg (',' TypeArg)* ','? ']'      -- generic instantiation

TypeArg      := TypeExpr
              | Expr                                        -- value generic (e.g., usize)

TypeAtom     := Path
              | 'Self'
              | 'dyn' TypeExpr
              | TupleType
              | FnType
              | ParenType

TupleType    := '(' ')'
              | '(' TypeExpr ',' ')'
              | '(' TypeExpr (',' TypeExpr)+ ','? ')'

FnType       := 'fn' '(' (TypeExpr (',' TypeExpr)* ','?)? ')' ('->' TypeExpr)?

ParenType    := '(' TypeExpr ')'
```

`dyn TypeExpr` is the type of a dynamic-dispatch trait object. `TypeExpr` in that position must be a trait reference.

`TypeIntersection` (`A & B`) is permitted at use sites for endpoint constraints and bounds (`fn pick[T: Drivable & Insurable](...)`). Intersection at type definition (`type X = A & B`) is permitted only for record types; intersection across kinds is a semantic error.

#### 3.16.1 Type Path Disambiguation

A path followed by `[...]` is a generic instantiation in type position. In expression position, the same syntax is parsed as indexing.

```
type alias FloatVec = Vec[f32]               -- generic in type position
let xs: Vec[f32] = ...                       -- generic
let first = xs[0]                            -- indexing: same brackets, different position
```

### 3.17 Top-Level Forms — Summary

```
ModuleItem   := UseItem
              | ExtendItem
              | AnnotatedDecl

AnnotatedDecl := Annotation* DocComment? Decl

Decl         := SignalDecl
              | DerivedDecl
              | TypeDecl
              | EnumDecl
              | TraitDecl
              | NodeDecl
              | ConnectionDecl
              | FnDecl
              | NodeInstantiation
              | AliasDecl
```

---

## 4. Operator Precedence and Associativity

Listed lowest to highest. Operators on the same line have equal precedence.

| Level | Operators                        | Associativity | Notes                                         |
| ----- | -------------------------------- | ------------- | --------------------------------------------- |
| 1     | `or`                             | left          | logical-or                                    |
| 2     | `and`                            | left          | logical-and                                   |
| 3     | `not` (prefix)                   | right         | logical-not                                   |
| 4     | `is`, `is not`, `<`, `<=`, `>`, `>=` | non-associative | comparison; chaining rejected by typer    |
| 5     | `>>`                             | left          | pipe-forward                                  |
| 6     | `as`                             | left          | type cast                                     |
| 7     | `+`, `-`, `+%`, `-%`, `+\|`, `-\|` | left        | additive                                      |
| 8     | `*`, `/`, `%`, `*%`, `*\|`       | left          | multiplicative                                |
| 9     | `-` (prefix)                     | right         | unary negation                                |
| 10    | `?`, `.`, `[]`, `()`             | left          | postfix: try, member, index, call             |
| 11    | `::`                             | left          | path                                          |
| 12    | atoms                            | —             | literals, identifiers, parens, constructions  |

Notes:

- The placement-context `|` (attribute pipe) is **not** an expression operator. It appears only after a `TypeRef` in placement position and follows the placement grammar in §3.10.
- The placement-context `/` (default-arg) is also outside this table; it appears only between a `TypeRef` and its default-argument expression in placement position.
- `&` (type intersection) is a type-expression operator, not part of the value-expression precedence table.
- `'is not'` is two tokens but parses as a single comparison operator with the same precedence as `is`.

---

## 5. Open Issues

The following items are syntactically permitted by this grammar but require pinning in the semantics document:

1. **Trait `attr` declarations**: §3.7 permits `attr` inside trait bodies. Whether these are required for trait conformance, optional, or carry default values is unspecified at the grammar level.
2. **Trait method dispatch**: `dyn Trait` syntax is recognized; object-safety rules are semantic.
3. **`with` functional update**: §3.15.5 sketches a placeholder syntax; final form pending review.
4. **Comparison chaining**: §3.15 admits `a < b < c` syntactically; the type system must reject it.
5. **String interpolation expression scope**: `{Expr}` inside a string permits arbitrary expressions, including nested strings and method calls. The recursion depth and any restrictions are semantic.
6. **`else` requirement on `if`-as-expression**: enforced by type system, not grammar.
7. **Numeric suffix on float-only types**: `120number` and `120int` — the grammar treats `number` and `int` as suffixes but their applicability to integer-shaped vs float-shaped literals needs semantic precision (currently `number` implies float context, `int` implies integer context).
8. **File extension and module manifest**: outside the scope of this grammar.

---

## 6. Reserved for Future Extension

The following are intentionally not part of this grammar and are reserved for possible future versions:

- Higher-kinded type parameters (`F[_]`)
- Variance markers on generic parameters (`+T`, `-T`)
- Effect rows / capability tracking
- Macros / metaprogramming beyond `@derive`
- Async functions and `await`
- Mutable local bindings (`var`) — explicitly rejected
- Statement-form `if` without `else`-as-required
- Range literal syntax (`a..b`) — provided as stdlib `range(...)` only
- `==` / `!=` symbolic equality — replaced by `is` / `is not` keywords
- Bitwise-or symbolic operator — `|` is reserved for placement attribute pipes
