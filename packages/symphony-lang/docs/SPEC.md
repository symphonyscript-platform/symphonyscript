# Symphony Language Specification

**Status:** Draft v0.1. Living document. Working reference for the language's
design. Pairs with `GRAMMAR.md` (lexical and syntactic structure) and
`Topics.md` (decision log).

---

## 1. Introduction

### 1.1 Purpose

This specification is the authoritative source for Symphony's type system,
evaluation model, and runtime semantics. Implementation details (compiler
internals, optimizations, runtime representation) are out of scope except where
they constrain user-visible semantics. The grammar of the language is specified
separately in `GRAMMAR.md`; this document refers to grammar productions where
relevant and does not duplicate them. Where the grammar and this specification
appear to conflict, this specification is authoritative; the grammar is to be
revised to match.

### 1.2 Status

The specification is under active development. The type system (this section
and §§2–10) is fully specified. The reactive system, runtime semantics, and the
node/connection composition model are partially specified or deferred. Sections
labeled "deferred" indicate decisions consciously postponed for later
refinement.

### 1.3 Design Philosophy

Symphony is a general-purpose, statically typed language designed to make
compositional reactive systems first-class. Its initial application domain is
code-first music composition, but the language commits to no domain-specific
primitives.

The language is built on a small set of load-bearing principles:

**Strong static types with minimal ceremony.** Every value has a concrete type
known to the compiler at code generation time. Most types are inferred from
context. Annotations are required only where inference is ambiguous or where
the user wants to pin a choice deliberately.

**Immutability by default; isolated local mutation as escape hatch.**
External state — module-level declarations, type definitions, signals,
function parameters, record fields as a property of types — is always
immutable. There is no module-level `mut`, no globally-mutable state.
Inside function bodies, controlled local mutation is available through
`mut` bindings (§11). Mutation is bounded to the function body that
declared it; callers never observe a function's internal mutations
except through its declared return value. Time-varying *external*
behavior is expressed through the reactive system, not through
assignment.

**Single ownership.** Every value has exactly one owner at any moment.
Passing a non-`Copy` value to a function transfers ownership; the
caller's binding is consumed. Returning a value transfers ownership back
to the caller. Read-only access to a non-`Copy` value without ownership
transfer is provided through call-scoped borrows (`&T` parameters) per
§11.9. There is no garbage collector, no reference counting at the
language level (the runtime may use refcounting internally for specific
types like `string` per §11.6), and no shared mutable state.

**Effectively pure functions.** From a caller's perspective, every
user-defined function is referentially transparent: same inputs produce
the same outputs, with no externally observable side effects on the
caller's bindings beyond the function's declared return value. A
function may use `mut` bindings, indexed assignment, and `while`/`for`
loops *internally* (§11, §12), but these are implementation details
invisible at the call site. The reactive system provides the controlled
mechanism for time-varying behavior across the program; ordinary
computation is pure-by-contract.

**Compile-time evaluation where possible.** Pure functions and immutable
bindings together mean that any expression not involving a signal or external
input is compile-time evaluable. The language uses this aggressively for
type-level computation, value-fits-type checking, and dependent-ish typing.

**Nominal types.** Records, enums, traits, nodes, and connections are nominal —
identity is by name, not structure. Tuples and trait-constraint intersections
are explicit structural carve-outs with clear semantics.

**Traits as the abstraction mechanism.** Behavior abstraction uses nominal
traits with explicit `satisfies`/`fulfill` declarations. Coherence is enforced
structurally via orphan rules.

**Uniform function call syntax.** Methods, free functions, and pipe-forward
calls are interchangeable syntactic forms for the same underlying operation.
Records carry data; functions carry behavior; the call site chooses the form
that reads best.

**Two-track failure model.** Failures are either bugs (traps, process abort, no
catch mechanism) or recoverable conditions (`Option`/`Result` values, `?`
propagation). The choice is made at the operation site, not retroactively.

### 1.4 Conventions

Code examples use Symphony syntax per `GRAMMAR.md`. Type-name case conventions:

- Concrete primitive types: lowercase (`i32`, `f64`, `bool`, `char`, `string`, `never`).
- Built-in placeholder keywords: lowercase (`numeric`, `integer`, `float`, `signed`, `unsigned`).
- Trait names: PascalCase (`Numeric`, `Add`, `Display`, `Ord`).
- User-defined type names: PascalCase (`Vec3`, `Person`, `Event`).
- Identifiers (functions, variables, fields): snake_case (`full_name`, `first_name`).

"The compiler" refers to the implementation's static analysis phase. "Runtime"
refers to execution. "Codegen" refers to the boundary at which all types must
be concrete.

---

## 2. Type System Foundations

This section specifies the fundamental machinery of the type system: how types
flow through a program (placeholders), when they are checked (inference and
definition-time analysis), how they are realized in code (monomorphization),
and how compile-time evaluation participates in the type system.

### 2.1 Placeholders

The type system contains a category of compile-time-only types called
*placeholders*. A placeholder represents a type that has not yet been resolved
to a concrete type. Placeholders exist solely during type checking and are
eliminated before code generation. Every runtime value has a concrete machine
type; the placeholder mechanism is the compiler's machinery for determining
what that concrete type is.

#### 2.1.1 Placeholders attach to values, not bindings

A placeholder is a property of a *value*. When a value with a placeholder type
flows through a binding, the binding carries the placeholder forward
transparently:

```
let x = 5
```

The literal `5` produces a value with an integer placeholder. The binding `x`
is a transparent alias for that value; `x` itself does not have a type
independent of its value.

#### 2.1.2 Resolution at use sites

A placeholder is resolved to a concrete type at a *use site* — a position in
the code where the value participates in an operation requiring a concrete
type. Use sites include:

- An explicit type annotation (`let y: i32 = x`).
- An argument to a function parameter with a concrete type.
- An operand to an operator whose other operand is concretely typed.
- A field assignment in a record where the field type is concrete.
- A return value of a function with a concrete return type.

Each use site resolves the placeholder independently. The same placeholder-
bearing value used at two different use sites can resolve to two different
concrete types:

```
let x = 5
let a: i32 = x      // x resolves to i32 here
let b: i64 = x      // x resolves to i64 here
```

This is sound because the value `5` is compile-time known (§2.4) and the
compiler verifies it fits both target types.

Resolution at a use site considers all information available at that site,
including other operands' types in the same expression and the value-fits
check from §2.4.3. The integer/float kind of a placeholder tags it for
defaulting (§3.1.5) but does not prevent resolution to a compatible type of
a different kind, provided the value fits exactly:

```
let x = 5
let f: f64 = x         // ✓ integer placeholder resolves to f64; value 5 fits exactly
let g: f32 = x         // ✓ same; value 5 fits exactly in f32
let h = x * 1.5_f32    // ✓ integer placeholder resolves to f32 in mixed-kind expression
                       //   per the placeholder cross-kind resolution rule (§2.1) and
                       //   the value-fits-type check (§2.4.3); value 5 fits exactly in f32
```

A binding whose right-hand side is itself an expression with a placeholder
follows the same rule applied to the expression: the expression resolves first
using its own context (operand types, value-fits, defaulting), and the binding
adopts the resolved type. The binding's annotation status (or absence) does
not provide context to the expression; resolution flows forward from
expression to binding, not backward.

#### 2.1.3 Bindings to concretely-typed expressions

When a binding's right-hand side has a concrete type, the binding carries that
concrete type. There is no placeholder to propagate:

```
let x: i32 = 5             // x is i32
let y = some_function()    // y is whatever some_function() returns, concretely
```

#### 2.1.4 Resolution failures

A use site that cannot resolve its placeholder produces a compile error
*at the use site*. Errors are local to the use site, not propagated back to the
binding. Unused bindings (dead code) require no resolution and produce no error
from the placeholder mechanism, though they may produce a separate
unused-binding warning.

A single value used at multiple use sites that demand mutually incompatible
concrete types is also a use-site issue, surfaced as errors at the conflicting
sites.

#### 2.1.5 No first-class runtime placeholders

The placeholder is strictly compile-time. No value at runtime has placeholder
type; no machine representation corresponds to a placeholder. This forecloses
dynamic typing in disguise and keeps memory layout, dispatch costs, and
codegen output predictable.

### 2.2 Type Inference

The compiler infers types for variables, function parameters, function return
types, and generic type parameters using a bidirectional inference algorithm.
Users provide annotations where necessary; the compiler fills in the rest.

#### 2.2.1 Inference mechanism

Inference operates within function bodies and across function signatures (for
generic instantiation). At a high level, the algorithm:

1. Treats every omitted type annotation as a fresh placeholder.
2. Generates constraints from the expression structure (operator types,
   function signatures, field types, etc.).
3. Solves the constraints, resolving placeholders to concrete types or to
   trait-constrained type variables.
4. Reports errors at sites where constraints cannot be satisfied.

#### 2.2.2 Definition-time body checking

Generic function bodies are typechecked at definition, not deferred to call
sites. The compiler analyzes the body's operations to determine the constraints
on the generic parameters:

```
fn lerp(a, b, c):
  a + (b - a) * c
```

From the body, the compiler infers that `a`, `b`, and `c` must support `+`,
`-`, and `*`. The inferred constraints are attached to the function's
signature; call sites must satisfy them.

Definition-time checking gives error locality (bugs in the body point at the
body, not at call sites), enables isolated verification of generic functions
(a generic function is valid before any call exists), and supports tooling for
uncalled generics.

#### 2.2.3 Implicit and explicit generics are equivalent

A function with omitted parameter types is generic. Each omitted parameter type
becomes a *distinct* fresh generic parameter. The implicit form desugars
mechanically to the explicit form, one fresh parameter per omitted slot:

```
fn lerp(a, b, c): a + (b - a) * c
// initial desugaring (before inference):
fn lerp[T0, T1, T2](a: T0, b: T1, c: T2): a + (b - a) * c
```

The desugaring produces three distinct type parameters because there are three
omitted parameter types. Inference (§2.2.1) then generates constraints from the
body's operations and may unify some parameters with each other if the body's
operations force them to be the same type. For `lerp`, the body `a + (b - a) *
c` constrains the parameters such that inference may unify them into one — but
the unification is a *result* of inference, not part of the desugaring.

For a function whose body does not relate its parameters, the synthesized
parameters remain distinct:

```
fn pair(a, b): (a, b)
// desugars to (and stays as):
fn pair[T0, T1](a: T0, b: T1) -> (T0, T1)
```

Here `a` and `b` are not connected by any operation, so `T0` and `T1` remain
independent generic parameters and the function is genuinely generic in two
parameters.

The implicit and explicit forms produce the same code and the same semantics.
The choice between them is stylistic. Mixed forms are permitted: some
parameter types explicit, others omitted, with the omitted ones receiving
fresh parameters per the same rule.

#### 2.2.4 Trait-based constraints

Inferred constraints reference traits (§3). Operations in the body resolve to
trait methods (`+` resolves to `Add::add`, etc.), and the relevant trait
becomes the constraint on the corresponding parameter. The trait system's
umbrella traits (§3.6) let the compiler simplify inferred constraint sets for
readability: `Add + Sub + Mul + Neg + Zero + One` may collapse to `Numeric`
when unambiguous.

#### 2.2.5 Type-argument inference at call sites

When a generic function is called, the compiler infers the type arguments from
the call's argument types where possible. Explicit type arguments are an
opt-in fallback using turbofish syntax `::[T]`:

```
let r = lerp(0.0_f64, 1.0_f64, 0.5_f64)        // T inferred from arguments
let r = lerp::[f64](0.0, 1.0, 0.5)             // T explicit
```

The `::` prefix on the type-argument list disambiguates from indexing
(see `GRAMMAR.md` §3.15–§3.16). Without `::`, `foo[T](args)` is ambiguous
between "index `foo` with `T`, then call" and "call generic `foo` with type
argument `T`". The `::` forces path-navigation mode where `[T]` is
unambiguously a type-argument list.

#### 2.2.6 Type wildcards

The identifier `_` in a type-annotation position denotes a type that the
compiler should infer from context. It is a placeholder per §2.1, resolved
at its use site by the surrounding type information.

```
let r: Result[i32, _] = compute()       // i32 pinned; error type inferred
let v: Vec[_] = make_ints()             // element type inferred
let pair: (_, string) = build()         // tuple's first component inferred
```

The wildcard is permitted in any type-expression position: generic
arguments, tuple components, function return types in annotations,
trait-bound positions where inference can resolve the constraint, and
others. If the compiler cannot infer the type at the wildcard's site from
the surrounding context, the resulting error is reported at the wildcard's
location, identifying the inference failure and what context was missing.

The wildcard is distinct from the pattern wildcard `_` (used in pattern
matches per §6.2.4). They share the same character but appear in different
syntactic positions; the parser disambiguates by position.

### 2.3 Monomorphization

Generic functions are realized in code via monomorphization: each unique
combination of concrete type arguments produces a separate specialized function.
There is no type erasure, no boxing, no dynamic dispatch for static generic
calls. Users pay no runtime cost for generic abstraction beyond the cost of the
specialized operations themselves.

#### 2.3.1 Instantiation granularity

Each unique tuple of concrete type arguments at a call site produces a distinct
instantiation. `lerp(i32, i32, i32)` and `lerp(i32, i32, f64)` are separate
instantiations even if their machine code happens to be similar. Backend
codegen may deduplicate identical machine code as an optimization, but this
deduplication is semantically invisible.

#### 2.3.2 Cross-module instantiation

Monomorphization is per-call-site across module boundaries. A generic function
defined in module A and called from modules B and C with different concrete
types produces separate instantiations in each calling module. Consequence:
generic function bodies must be available (in source or intermediate
representation) to any module that calls them. Generic definitions are not
closed binary units from the linker's perspective. (This is a constraint on the
module system design, not on the type system.)

#### 2.3.3 Polymorphic recursion is forbidden

Polymorphic recursion — a recursive call within a generic function body that
would require a different type instantiation than the caller — is rejected at
compile time. Direct same-type recursion (the recursive call has the same type
arguments as the caller) is permitted and reuses the same instantiation.

This restriction guarantees that monomorphization terminates and produces a
finite set of instantiations. The use cases where polymorphic recursion is
genuinely needed (certain advanced data structures, functional patterns) are
out of scope for v1; explicit dynamic dispatch via `dyn` (§5) is available
for cases that require it.

#### 2.3.4 Dead code elimination

Dead code elimination operates per-instantiation. Each monomorphized variant is
independently eligible for elimination. A generic function with no call sites
produces no output. A generic function called with some type combinations but
not others produces exactly the instantiations called, nothing more. The
semantic unit for codegen is the instantiation, not the generic.

#### 2.3.5 Trait method dispatch in monomorphized code

Trait method calls in monomorphized code resolve to direct function calls to
the concrete implementation. There is no vtable, no indirection, no runtime
dispatch cost for static generic calls. Coherence (§3.7) guarantees
unambiguous resolution: exactly one `fulfill` block exists per (trait, type)
pair within the module graph.

Dynamic dispatch is available as an opt-in mechanism via `dyn` trait objects
(§5). This is the only path through which trait method calls incur runtime
indirection.

#### 2.3.6 Binary size

Monomorphization trades binary size for runtime performance and type
information preservation. For typical programs the tradeoff is favorable; for
programs with heavy generic instantiation across many type combinations, binary
size can grow. Mitigations available as later optimizations:

- Backend deduplication of identical machine code (already mentioned in
  §2.3.1; an implementation concern, not a semantic feature).
- Outlining of type-independent code into shared helpers.
- Opt-in dynamic dispatch via `dyn` trait objects, at the cost of indirection.

None of these change the language's semantic model. They are levers available
to implementations if binary size becomes a real constraint.

### 2.4 Compile-Time Evaluation

The language evaluates expressions at compile time whenever possible.
Compile-time-known values participate in type-level computation, value-fits-type
range checking, dependent-ish typing, and the elimination of runtime checks the
compiler can prove unnecessary. Compile-time evaluation is a semantic feature,
not an optimization: the language's design relies on it.

#### 2.4.1 Compile-time-known values

A value is *compile-time known* if its defining expression is compile-time
evaluable. The propagation rule is mechanical:

- Literals are compile-time known.
- Constructions over compile-time-known operands are compile-time known.
- Operations over compile-time-known operands are compile-time known.
- Calls to pure functions with compile-time-known arguments are compile-time
  known.
- Bindings of compile-time-known expressions are compile-time known.

Since all user-defined functions are pure (§1.3) and all bindings are
immutable, compile-time-knowability propagates freely through the expression
graph. The compiler determines compile-time-knowability automatically; users do
not annotate it for `let` bindings.

#### 2.4.1.1 `let` and `const` binding forms

The language has two binding forms:

- **`let`** — the general binding form. Immutable. The compiler determines
  compile-time-knowability automatically from the expression. A `let` bound
  to a non-reactive expression is compile-time known and may be tree-shaken,
  inlined, or otherwise optimized; a `let` bound to a reactive or runtime
  expression participates in the reactive graph and exists at runtime.
- **`const`** — a stricter binding form. The user *asserts* that the binding
  is compile-time-only; the compiler enforces this assertion and additionally
  guarantees the binding has no runtime existence whatsoever.

```
const PI = 3.14159
const TAU = 2.0 * PI            // derived from another const, also compile-time
const MAX_ITEMS: usize = 1024

let x = 5                       // compile-time known, but compiler decides what to do
let y = compute(input)          // compile-time known iff input is non-reactive
let z = read_sensor()           // reactive, runtime
```

#### 2.4.1.2 Semantics of `const`

A `const` binding has three properties beyond what `let` provides:

1. **Non-reactive guarantee.** The RHS must not involve any signal, derived
   value, external input, or reactive expression. Violation is a compile error
   at the `const` declaration site, identifying the source of reactivity. This
   makes intent visible at the binding site: readers see `const` and know,
   without scanning the RHS, that the value is purely compile-time.

2. **No runtime existence.** A `const` does not occupy a runtime memory
   location. Wherever it is referenced from non-`const` code, the value is
   inlined directly. Wherever it is referenced from another `const` or from
   type-level context, the value is used at compile time only. A `const` that
   is unreferenced (or referenced only from compile-time contexts whose results
   are themselves unused) does not appear in the compiled output at all.

3. **No addressability.** Because a `const` has no runtime location, it has
   no address. Operations that would require a runtime address (passing by
   reference, storing a pointer, FFI sharing) are compile errors. The `const`
   is a *value*, not a *location*.

#### 2.4.1.3 `const`-eligible types

A type is `const`-eligible if all of its values can be fully represented at
compile time, with no runtime allocation and no runtime state. The set
includes:

- All primitive types: `i8`–`i128`, `u8`–`u128`, `isize`, `usize`, `f32`,
  `f64`, `bool`, `char`, `string`, `never`.
- Fixed-size arrays whose element type is `const`-eligible.
- Records whose field types are all `const`-eligible.
- Enums (including payload-carrying) whose payload types are all
  `const`-eligible.
- Tuples whose component types are all `const`-eligible.
- Newtypes wrapping `const`-eligible types.

Types not `const`-eligible:

- Heap-allocated collection types (`Vec`, `HashMap`, etc.).
- Signal-bearing or reactive types.
- Types containing function references or closures with captured runtime state.
- `dyn` trait objects.

The compiler checks `const`-eligibility at the declaration site. A `const`
declaration whose RHS produces a non-`const`-eligible type is rejected with a
clear error identifying the offending type.

#### 2.4.1.4 `const` declaration sites

`const` is permitted at:

- Module top level — for shared constants and configuration values.
- Inside function bodies — for local compile-time-only values used in
  type-level positions (e.g., array sizes computed from arguments to a
  generic function).
- Inside type, trait, node, and connection bodies — for type-associated
  constants accessible via path syntax (`Vec3::ZERO`, `Color::WHITE`).

`const` declarations follow the same visibility model as other declarations
(§10): `public const TAU = ...`, `private const INTERNAL_THRESHOLD = ...`,
default `shared`.

#### 2.4.1.5 Relationship between `const` and `let`

The two forms coexist:

- A `let` bound to a non-reactive expression is *effectively* eligible for
  `const`-style optimization (tree-shaking, inlining), but the user has not
  asserted this and the compiler has not enforced it. The binding may or may
  not exist at runtime depending on whether anything observes it.
- A `const` is *guaranteed* not to exist at runtime, and the compiler enforces
  the non-reactive constraint. Users choose `const` to encode their intent
  and obtain the enforcement.

A `let` bound to an expression that uses `const` values is itself
compile-time known (constants propagate through pure expressions per §2.4.1).
There is no need to "promote" `let` to `const` for downstream `const` use; the
propagation rule covers it.

Tooling may suggest converting an eligible `let` to `const` as a stylistic
hint, but the compiler does not require it. The choice between the two forms
is the user's assertion about intent; the language does not infer the
assertion.

#### 2.4.2 Breaks in propagation

Two categories of expression are not compile-time known:

- Expressions involving *signals* (§Reactive System, deferred) or any reactive
  value derived from a signal. Signal values depend on the moment of evaluation
  and are inherently runtime.
- Expressions involving external I/O, host-boundary calls, or any future
  construct whose value is determined by the runtime environment.

Once a reactive or runtime dependency enters an expression's evaluation, the
expression and all derived values become runtime values. The propagation is
transitive: a function call whose argument includes a reactive value produces
a reactive result; a binding to a reactive expression is itself reactive.

#### 2.4.3 Value-fits-type checking

Compile-time-known values are checked against the type constraints they meet
in context. The compiler verifies that the value fits the demanded type and
produces a compile error if it does not:

```
let x: u8 = 200            // ✓ 200 fits in u8 (range 0..255)
let x: u8 = 300            // ✗ compile error: 300 doesn't fit u8
let x: i8 = -50            // ✓ -50 fits in i8 (range -128..127)
let x: u8 = -1             // ✗ compile error: -1 doesn't fit u8
let x: f32 = 5             // ✓ 5 exactly representable in f32
```

This applies to any compile-time-known value, however computed:

```
let y = 200
let z: u8 = y              // ✓ y is compile-time known as 200, fits u8
let w: u8 = y + 50         // ✓ compile-time evaluates to 250, fits u8
let v: u8 = y + 100        // ✗ compile-time evaluates to 300, doesn't fit u8

fn double(x: i32) -> i32: x * 2
let f = double(100)        // ✓ pure call, evaluates to 200
let g: u8 = f              // ✓ 200 fits u8
```

Integer values require exact fit. Float literal values fit any float type,
rounded to nearest representable. Integer-to-float fit follows the lossless
conversion rules (§4.5).

#### 2.4.4 Compile-time evaluation as type-level mechanism

Compile-time-known integer values can serve as type-level arguments. The
const-generic mechanism (§Generic Parameters) uses this directly:

```
let arr: i32[fib(10) + 1]                  // valid; fib(10) + 1 is compile-time evaluable
type Buffer[T, N: usize = 1024]:
  data: T[N]
```

This is dependent-typing-lite: types can depend on compile-time-known values
without requiring full dependent type theory. The mechanism is uniform —
anything compile-time evaluable can appear in a type position requiring a
value.

#### 2.4.5 Negative literal parsing

The integer-literal-with-sign sequence `-N` is parsed as a single signed
literal token for type-checking purposes. `let x: i8 = -5` checks the value
`-5` against `i8`'s range; it does not apply the runtime unary-minus operator
to a literal `5` (which would conflict with the rule that unary `-` on
unsigned integers is a type error — see §4.4.1). The runtime unary-minus
operator's rules still apply to runtime values; only literal parsing is
special.

#### 2.4.6 Reactivity provenance in diagnostics

The compiler tracks reactivity provenance through expressions. When an
expression's value is reactive, the compiler can identify the signal(s)
it depends on. This information surfaces in two places:

- **Errors that explicitly require compile-time evaluation.** A `const`
  declaration (§2.4.1.2) whose RHS is reactive is a compile error per
  §2.4.1.2's non-reactive guarantee. A type-level position requiring a
  compile-time-known value (e.g., a const-generic argument or an array
  length per §2.4.4) supplied with a reactive expression is likewise an
  error. The diagnostic names the source signal:

  ```
  const N: usize = sample_count(mouse_position)
  // error: `const` RHS must be non-reactive; value depends on signal
  //   `mouse_position` (at line 14). For a runtime-derived value, use
  //   `let` instead.
  ```

- **Diagnostic context, not error cause, for ordinary runtime bindings.**
  A reactive value assigned to a regularly-typed binding is *not* an error
  on reactivity grounds — `let x: u8 = compute(mouse_position)` is well-
  typed whenever `compute(mouse_position)` has type `u8` (or implicitly
  widens to `u8` per §4.5). Value-fits-type checking per §2.4.3 applies
  only to compile-time-known values; reactive values are checked by
  ordinary type-compatibility rules. If an error does arise (e.g., the
  reactive value's type doesn't match `u8` and no implicit widening
  applies), the diagnostic mentions the signal provenance to help the
  user trace the value's origin, but the underlying error is a type
  mismatch, not a fit-check failure.

#### 2.4.7 Implementation limits

Practical limits on compile-time evaluation (recursion depth, evaluation step
count, memory used) are implementation concerns. The compiler enforces
configurable limits to prevent runaway evaluation from hanging compilation.
When a limit is exceeded, the compiler reports an error indicating which limit
was reached and at what call site.

Floating-point compile-time evaluation uses the target's IEEE 754 format
exactly. Compile-time and runtime float computations on the same expression
must produce bit-identical results. This is a correctness requirement, not a
performance optimization.

---

## 3. Trait System

Traits are the language's abstraction mechanism for behavior. A trait declares
an interface — a set of method signatures, associated types, and requirements —
that types may explicitly conform to and provide implementations for. Generic
code expresses constraints in terms of traits; the compiler resolves trait
methods at monomorphization time per §2.3.5.

The trait system is nominal throughout: a type satisfies a trait only via an
explicit declaration of conformance, never by accidental structural match. Two
types with structurally identical method sets are distinct unless both have
explicitly declared (and implemented) the same trait.

### 3.1 Trait Declarations

A trait is declared with the `trait` keyword (grammar §3.7). The body of a
trait declares method signatures, associated types, requirements on other
traits, and optionally default values for the trait's defaulting behavior.

```
trait Display:
  fn display(value: Self) -> string

trait Add[Rhs = Self]:
  type Output
  fn add(left: Self, right: Rhs) -> Output

trait Producer:
  type Item
  fn produce(value: Self) -> Option[Item]
```

A trait declaration may be empty:

```
trait Marker
```

Empty traits ("marker traits") have no methods, no associated types, and no
requirements. They serve as nominal tags — a type's `satisfies Marker` clause
is a declarative assertion the user makes about the type, checked only for
existence by the compiler.

#### 3.1.1 Method signatures

Trait methods are declared with the `fn` keyword inside the trait body. The
signatures use `Self` (capitalized, the type-level identifier) to refer to the
implementing type:

```
trait Eq:
  fn eq(a: Self, b: Self) -> bool
```

`Self` is a type-level placeholder bound during implementation: in a `fulfill
Eq for i32` block, `Self` resolves to `i32`, so the method's signature becomes
`fn eq(a: i32, b: i32) -> bool`.

Trait methods do not use a `self` parameter. The lowercase `self` keyword is
reserved exclusively for reactive context inside node and connection bodies
(§ — Reactive System, deferred). Trait method signatures name their receiver
parameter explicitly. The first parameter's type is conventionally `Self` for
methods that operate on instances, but trait methods may have any parameter
list — including no `Self` parameter at all (for "associated functions" like
constructors).

#### 3.1.2 Associated types

A trait may declare associated types using the `type` keyword inside the body:

```
trait Producer:
  type Item
  fn produce(p: Self) -> Option[Item]
```

`Item` is an associated type — a type-level name whose concrete value is bound
by each implementation. Associated types may be referenced in the trait's
method signatures and in other associated-type expressions.

An associated type may declare a default value:

```
trait Add[Rhs = Self]:
  type Output = Self
  fn add(left: Self, right: Rhs) -> Output
```

When an implementation does not bind `Output` explicitly, the default applies.

Implementations bind associated types via the `type Name = Concrete` form
inside `fulfill` blocks (§3.4.3).

Bounds on associated types in generic constraints use where-clauses with the
`.` member-access notation (§3.3.4 for where-clauses; §3.1.6 for generic
trait parameters):

```
fn sum[P: Producer](p: P) -> P.Item where P.Item: Numeric:
  ...
```

#### 3.1.3 Default method bodies

A trait may provide a default implementation for any of its methods by
including a function body in the trait declaration:

```
trait Greet:
  fn greet(value: Self) -> string

  fn shout(value: Self) -> string:
    greet(value).to_upper() + "!"
```

Here `greet` is abstract (no body, must be implemented); `shout` has a default
body that delegates to `greet`. An implementation may override the default by
providing its own body in the `fulfill` block, or accept the default by
omitting the method.

#### 3.1.4 Super-trait requirements (`requires`)

A trait may require that any type implementing it also implements other traits.
Requirements are declared with the `requires` keyword (grammar §3.7):

```
trait Student:
  requires Person
  fn enrollment_id(value: Self) -> string
```

A type `T` satisfies `Student` only if `T` also satisfies `Person`. The
compiler enforces this at the point `satisfies Student` is declared on the
type: if `Person` is not in the type's `satisfies` set (directly or
transitively), the declaration is rejected.

A child trait may not redeclare a method already declared by any of its
required traits (directly or transitively). If `Person` declares `fn display(
value: Self) -> string`, then `Student` declaring its own `fn display(value:
Self) -> string` is a compile error at the trait declaration site. The
reasoning: any type satisfying `Student` would also satisfy `Person` via
`requires`, so the type's effective method set would contain two `display`
methods — exactly the conflict §3.2.1 forbids. Rejecting redeclaration at the
trait level surfaces this problem at the trait author's site, not at the
type author's site.

This rule forecloses inheritance-style method override in trait hierarchies.
Child traits compose by adding *new* methods to the required trait's
interface, not by replacing existing ones. If a different behavior for an
existing method name is needed, the right tool is a separate trait (with a
different method name) or a newtype with its own conformance, not override
through `requires`.

The signature-no-redeclaration rule applies to signatures only. Default
bodies remain overridable at the *fulfill site* per §3.1.3 — a type
implementing the trait may provide its own body, replacing any default the
trait declared. The override happens at the type's implementation, not at
the trait level. This separation keeps signature stability (contracts don't
shift) decoupled from implementation flexibility (types choose how to fulfill
the contract).

Default bodies are themselves part of the trait that declares them. A child
trait via `requires` inherits the parent's signatures *and* their default
bodies; it cannot redeclare either. Overriding the default body happens only
at the fulfill site, not by re-providing a default in a child trait. This
preserves the principle that a method — both its signature and its default
body — has exactly one origin: the trait that originally declared it. Types
choose how to fulfill it; the trait hierarchy does not provide alternative
defaults at intermediate levels.

The `requires` mechanism is how trait hierarchies are constructed (§3.6).

#### 3.1.5 Trait-level default concrete type

A trait may declare a default concrete type used by the defaulting mechanism
(§3.6.2 for selection among multiple defaults; §4.9.3 for the numeric
default mappings). When a use site is constrained solely
by a trait (or traits) with declared defaults and nothing else pins the type,
the trait's default fires.

The default must itself satisfy the trait; this is compiler-enforced.

```
@default(i32)
trait Integer:
  requires Numeric, IntDiv, Rem, ...    // illustrative; canonical in §4.9.2
```

The exact syntactic form (annotation, dedicated keyword, body clause) is a
syntax detail; the semantic decision is that defaults are declared on the
trait, not on the compiler.

A trait without a declared default produces a compile error at any use site
that would require defaulting through it ("no default available for trait
X"). This treats missing defaults as a deliberate choice by the trait author:
some traits are too domain-specific to pick a default for.

Trait-declared defaults are the only defaulting mechanism in the language.
There are no compiler-internal defaults, no module-level pragmas, no
use-site overrides via alternative defaulting paths. When the default
mechanism does not fire (no constraining trait declares a default, multiple
incomparable defaults conflict per §3.6.2, or the user wants a non-default
type), the user resolves through explicit annotation, not through another
defaulting knob. This preserves the principle that defaults are discoverable
at the trait's declaration site and nowhere else.

#### 3.1.6 Generic traits

Traits may declare type parameters (grammar §3.7's `GenericParams`):

```
trait From[T]:
  fn from(value: T) -> Self

trait Add[Rhs = Self]:
  type Output
  fn add(left: Self, right: Rhs) -> Output
```

Type parameters on a trait are part of the trait's identity at the
type-system level. Two terms are useful when discussing generic traits:

- A **trait instance** is the trait paired with specific concrete type
  arguments — e.g., `From[i32]` is one trait instance; `From[i64]` is a
  different trait instance. The type system treats each instance as a
  distinct constraint and a distinct dispatch target.
- A **parent trait identity** is the trait's declared name independent of
  generic arguments — for both `From[i32]` and `From[i64]`, the parent
  trait identity is `From`. Several conformance and dispatch rules
  (§3.2.1, §3.4.1.1) operate at parent-trait granularity.

A type may implement multiple trait instances of the same parent trait
(`fulfill From[i32] for MyNumber` and `fulfill From[i64] for MyNumber`
coexist; both share the parent `From`). Default type parameters (`Rhs =
Self`) follow the rules for generic parameters in §3.1.6 and §2.2.

### 3.2 Conformance Declarations (`satisfies`)

A type declares conformance to a trait by including a `satisfies` clause in
its body (grammar §3.5 for records, §3.6 for enums, §3.8 for nodes, §3.9 for
connections):

```
type Person:
  satisfies Display, Hash
  first_name: string
  last_name: string
  age: i32
```

`satisfies` makes the conformance visible at the type's declaration site. A
reader of the type sees its full set of conformances without leaving the
type's file. The clause names the traits the type promises to implement; the
actual implementations live in `fulfill` blocks (§3.4), possibly in different
files (subject to the orphan rule from §3.7).

`satisfies` and `fulfill` are paired and both required for traits with
methods:

- `satisfies Trait` in a type body without a corresponding `fulfill Trait for
  Type` block reachable through the module graph is a compile error: the
  promise is unfulfilled.
- `fulfill Trait for Type` without a corresponding `satisfies Trait` in
  `Type`'s body is a compile error: the implementation has no declared
  contract.

The exception is traits with no methods (pure-requirement traits, §3.3.5):
these are automatically satisfied when all required traits are satisfied; no
`satisfies` clause is needed on the type and no `fulfill` block is needed for
the umbrella.

#### 3.2.1 No overlapping method names across satisfied traits

A type's `satisfies` set must not contain two *distinct trait identities*
whose method names overlap. If `Trait1` and `Trait2` (different traits, not
different instantiations of the same generic trait) each declare a method
named `display`, no type can declare `satisfies Trait1, Trait2` — the
compiler rejects the declaration with an error identifying the conflicting
method name and the two traits.

This rule preserves the contract semantics of `satisfies`. A reader of a
type's declaration sees the full set of contracts the type promises; if those
contracts had hidden naming conflicts, the contract sheet would be lying
about what `display` (or whichever method) does. By forbidding overlap at the
declaration site, the contract remains unambiguous: every method name on the
type maps to exactly one trait-method origin.

##### Generic trait instantiations do not conflict

Different generic instantiations of the *same parent trait* — e.g.,
`From[i32]` and `From[i64]`, or `Add[Self]` and `Add[Other]` — are
distinct trait instances per §3.1.6, but they share a parent trait
identity. Their method names refer to the same underlying trait method
parameterized over the trait's generic arguments. They do not conflict
under this rule:

```
type MyNumber:
  satisfies From[i32], From[i64]        // ✓ same parent trait From
  ...

fulfill From[i32] for MyNumber:
  fn from(value: i32) -> MyNumber: ...

fulfill From[i64] for MyNumber:
  fn from(value: i64) -> MyNumber: ...
```

The two `from` methods are disambiguated at call sites by argument type
(in the `From` direction, the source-value type pins the instance) or by
expected return type. Bare-name dispatch typically succeeds without
explicit annotation:

```
let n1 = MyNumber::from(5_i32)     // resolves to From[i32]::from
let n2 = MyNumber::from(5_i64)     // resolves to From[i64]::from
let n3: MyNumber = 5_i32.into()    // Into[MyNumber] from i32 — resolves through From[i32]
```

When inference cannot pick a unique instance (e.g., the argument is
polymorphic), explicit disambiguation via turbofish on the trait is
available per §3.4.1.1: `From::[i32]::from(value)`.

The conflict rule applies only to *different parent traits* with
overlapping method names. The universal identity `From[T] for T` (§7.3)
and a user-written `From[U] for T` are both instantiations of `From` and
therefore do not conflict — both are part of the same parent-trait
conformance.

##### Algorithm: effective method-set computation

Given a type `T` with `satisfies T1, T2, ..., Tn`, the compiler computes
`T`'s *effective method set* and checks for collisions:

1. Initialize the effective set as empty.
2. For each directly-satisfied trait `Ti`, compute the closure of `Ti` under
   the `requires` relation: `Ti` itself plus every trait reachable through
   any chain of `requires` clauses.
3. Union the method declarations of all traits in the closure for all `Ti`s
   into the effective set. Each entry is a (method-name, parent-trait-identity)
   pair, where *parent-trait identity* is the trait's declared name
   independent of generic arguments (so `From[i32]` and `From[i64]` share
   the parent identity `From`).
4. If two entries share the same method name but originate from different
   *parent-trait identities* (e.g., `Display`'s `display` and a different
   `MyDebug`'s `display`), the declaration is rejected. The error identifies
   the conflicting name and the two source parent traits.
5. Multiple entries with the same method name and the same parent-trait
   identity (i.e., different generic instantiations of the same parent —
   `From[i32]::from` and `From[i64]::from`) do *not* collide. They are
   logically the same method parameterized over generic arguments;
   dispatch among them is resolved by inference per §3.4.1.1.
6. Methods reached through multiple `requires` paths but originating from
   the same trait-method declaration are not in conflict — they are the
   same method, just reachable via multiple inheritance paths. This is the
   "diamond" case (well-defined in nominal trait systems) and is permitted.

The §3.1.4 rule (traits cannot redeclare methods from required traits)
guarantees that step 6's "same trait-method declaration reached multiple
ways" case has a single origin: the original declaring trait. There is no
ambiguity about which method is which when diamonds occur.

##### Workaround for legitimate dual conformance

When two traits a user wants both have conflicting method names *and
different parent identities*, the canonical workaround is the newtype
pattern: define separate newtype wrappers of the underlying type, each
satisfying one of the conflicting traits. Distinct newtypes have
distinct contract sheets and distinct method dispatches.

This workaround is unnecessary for different generic instantiations of
the same parent trait — those are permitted directly per step 5.

##### Consequence for dispatch

The rule shapes dispatch (§3.4): because no type can satisfy two traits
with *different parent identities* and overlapping method names, the
case of "multiple distinct-parent trait impls match this call site"
cannot arise. Call-site name resolution always finds at most one
parent-trait source for a given (type, method-name) pair. Within a
parent-trait source, multiple generic instantiations may match; these
are disambiguated by inference per §3.4.1.1.

### 3.3 Implementation Blocks (`fulfill`)

A `fulfill` block delivers a trait's implementation for a specific type:

```
fulfill Display for Person:
  fn display(value: Person) -> string:
    "{value.first_name} {value.last_name}"
```

The block lives in some module (subject to the orphan rule from §3.7), not
necessarily in the same module as either the trait or the type. Multiple
`fulfill` blocks for the same (trait, type) pair are rejected by the coherence
rule (§3.7): exactly one implementation exists per pair, reachable through
the module graph.

Functions defined inside a `fulfill Trait for Type` block live in a
*(Trait, Type)-scoped namespace*, not in the enclosing module's free-function
namespace. This is the key distinction from ordinary top-level function
definitions:

- A free function `fn display(p: Person)` defined at module level occupies a
  name slot in that module's free-function namespace. Per §10, function
  names are unique within their module; defining two free
  functions with the same name in the same module is a compile error.
- A function `fn display(value: Person)` defined inside `fulfill Display for
  Person` does *not* occupy the module's free-function namespace. It lives
  in the (`Display`, `Person`) trait-implementation namespace. The same
  module can contain multiple `fulfill` blocks for different (trait, type)
  pairs that each define functions named `display`; these do not conflict
  because they are in different namespaces.

This means stdlib (and user code) can define `fulfill Display for i32`,
`fulfill Display for i64`, `fulfill Display for f32`, etc. — all in the same
module — without name collisions, because each `display` is scoped to its
own (`Display`, `Type`) pair.

Coexistence with free functions: a module may simultaneously define a free
function `fn display(p: Person)` *and* contain a `fulfill Display for Person`
block whose method is also named `display`. The two functions live in
different namespaces and do not conflict at the definition site. They may
conflict at *call sites* under uniform-call-syntax dispatch — see §3.4 for
resolution rules.

The syntax (grammar addition):

```
FulfillItem  := 'fulfill' TypeExpr 'for' TypeExpr WhereClause? FulfillBody
FulfillBody  := NEWLINE INDENT FulfillBodyItem+ DEDENT
FulfillBodyItem := Annotation* DocComment? (FnDecl | AssocTypeBinding)
AssocTypeBinding := 'type' Ident '=' TypeExpr NEWLINE
```

`fulfill` is a reserved keyword.

#### 3.3.1 Method signatures and `Self` usage

`Self` is a type-level identifier that appears in trait declarations to refer
to the implementing type. Its use is asymmetric across declaration contexts:

- **In trait declarations**, `Self` is the standard way to refer to the
  implementing type, because the implementing type is not yet known. Trait
  authors write `fn display(value: Self) -> string`; there is no concrete
  name available to substitute, so `Self` is necessary.

- **In `fulfill` blocks**, the implementing type *is* known — it appears in
  the `for Type` portion of the `fulfill` declaration. The recommended form
  is to write the explicit type name in method signatures, not `Self`:

```
fulfill Eq for Person:
  fn eq(a: Person, b: Person) -> bool:
    a.first_name is b.first_name and a.last_name is b.last_name
```

`Self` remains *permitted* inside `fulfill` blocks and is treated as a
synonym for the implementing type (the compiler substitutes `Self` →
`Person` during type checking). The two forms produce identical signatures
and identical compiled code. The explicit-type-name form is preferred for
readability: a reader sees concrete types at every position, without an extra
indirection through `Self`.

Generic implementing types may make `Self` more convenient by keeping the
signature shorter:

```
fulfill Add for Vec3:
  type Output = Vec3
  fn add(left: Vec3, right: Vec3) -> Vec3:     // explicit
    Vec3(x: left.x + right.x, y: left.y + right.y, z: left.z + right.z)

fulfill Display for Result[T, E] where T: Display, E: Display:
  fn display(result: Result[T, E]) -> string:   // explicit, verbose but clear
    match result:
      Ok(value): "Ok({value.display()})"
      Err(error): "Err({error.display()})"
```

For generic types specifically, users may prefer `Self` to avoid repeating
the parameterization (`fn display(result: Self) -> string`). Both forms are
valid; the choice is stylistic.

The receiver parameter name (`a`, `value`, `result`, `left`, etc.) is always
the implementer's choice. There is no `self` keyword for trait method
receivers — that lowercase form is reserved exclusively for reactive context
inside node and connection bodies (§ — Reactive System, deferred). Explicit
parameter naming is the language's general principle under uniform function
call syntax: every parameter has a chosen name, not an implicit one.

Other type-level references in trait signatures (associated types like
`Output`, `Item`, etc.) follow the same substitution rule: in `fulfill`
blocks they may be written either with the trait's name (`Output`) or with
the concrete type bound to them.

#### 3.3.2 Associated type bindings

A `fulfill` block binds the trait's associated types via the `type Name =
Concrete` form:

```
fulfill Add for i32:
  type Output = i32
  fn add(left: i32, right: i32) -> i32:
    // built-in integer addition
```

An associated type with a default value in the trait declaration may be
omitted in the `fulfill` block; the default applies. An associated type
without a default must be bound explicitly.

#### 3.3.3 Default-body overriding

When a trait declares a method with a default body (§3.1.3), the
implementation may either inherit the default by omitting the method or
override it by providing its own body:

```
trait Greet:
  fn greet(value: Self) -> string
  fn shout(value: Self) -> string:
    greet(value).to_upper() + "!"

fulfill Greet for Loud:
  fn greet(value: Loud) -> string:
    "HELLO"
  // shout inherited from trait default

fulfill Greet for Polite:
  fn greet(value: Polite) -> string:
    "hello"
  fn shout(value: Polite) -> string:
    "(politely): " + greet(value)
  // shout overridden
```

Abstract methods (no default body) must be implemented; their absence in a
`fulfill` block is a compile error.

#### 3.3.4 Conditional implementations (where clauses)

A `fulfill` block may be conditional on its type parameters satisfying
additional traits. The condition is expressed via a where-clause attached to
the `fulfill` declaration:

```
fulfill Display for Result[T, E] where T: Display, E: Display:
  fn display(result: Result[T, E]) -> string:
    match result:
      Ok(value): "Ok({value.display()})"
      Err(error): "Err({error.display()})"
```

The implementation is available only when the type parameters satisfy the
required traits. A `Result[i32, string]` implements `Display` because both
`i32` and `string` do; a `Result[ClosureType, string]` does not, because
closure types typically do not implement `Display`. The compiler verifies
the conditions at every call site that requires the implementation.

#### 3.3.5 Pure-requirement traits and automatic satisfaction

A trait that declares no methods and no associated types — only `requires`
clauses — is a pure-requirement trait. Examples are the umbrella traits from
§3.6 (`Numeric`, `Integer`, `Float`, `Signed`, `Unsigned`).

Pure-requirement traits are automatically satisfied when all required traits
are satisfied. No `fulfill` block is needed for the umbrella; no `satisfies`
clause is needed on the type for the umbrella (though it may be included for
documentation). The trait is *structurally* satisfied via the satisfaction of
its requirements, but it remains *nominally* present in the trait system:
generic constraints `T: Numeric` are checked against the trait's name, and
the compiler verifies that `T`'s satisfied trait set includes everything
`Numeric` requires.

This carves out the only point of structural satisfaction in the language's
otherwise-nominal trait system, and it is bounded: the structural rule
applies only to traits with no methods. Any trait with method signatures
requires explicit `satisfies` + `fulfill` per §3.2.

#### 3.3.6 Visibility of `fulfill` blocks

`fulfill` blocks have no visibility specifier of their own. An implementation
is visible wherever both the trait and the type are jointly visible. If a
caller can name `Display` (per its visibility) and can name `Person` (per
its visibility), the call resolves to the `fulfill Display for Person` block;
the implementation's visibility is the intersection of the trait's and type's
visibility scopes.

This avoids the case where a trait and type are both visible but the
implementation is not, which would produce a confusing "method not found"
error at a site where the method clearly should exist.

### 3.4 Trait Method Dispatch

The language uses uniform function call syntax: a function whose first
parameter is of type `T` is callable in three equivalent forms. Trait methods
participate in this uniformly. Given a `fulfill Display for Person` block
containing `fn display(value: Person) -> string`, any of the following are
valid calls (and equivalent):

```
person.display()              // method-call form
person >> display             // pipe-forward form
display(person)               // conventional form, requires `display` in scope
Display::display(person)      // trait-path form, no import needed
```

The trait-path form (`Trait::method`) requires no `use` import — the
path itself makes the trait accessible by path, satisfying the in-scope
requirement for dispatch (§3.4.1). The trait must still be visible at
the call site under §10's visibility rules; "no import needed" does not
override visibility. Per §3.2.1 the bare-name forms are never ambiguous between
traits with *different parent identities* (a type cannot satisfy two
traits with different parents and overlapping method names). When a type
satisfies multiple generic instantiations of the *same* parent trait
(e.g., `From[i32]` and `From[i64]`), bare-name dispatch is normally
disambiguated by inference from argument or expected return type per
§3.4.1.1; explicit disambiguation via the trait-path form
(`Trait::[T]::method`) is available when inference cannot select one.
The other forms rely on name resolution per §10.

#### 3.4.1 Resolution across free-function and trait-implementation namespaces

A bare-name call `f(x)`, method-call `x.f()`, or pipe-forward `x >> f` may
resolve to either a trait-implementation function or a free function. The
resolution algorithm prioritizes trait implementations over free functions:

1. **Trait-impl search.** For each trait `T` reachable in the current scope
   (imported or accessible by path) such that `x`'s type fulfills `T` and `T`
   declares a method named `f`, collect the trait-impl candidate
   `T::f(x, ...)`. The function bodies live inside the corresponding `fulfill
   T for X` blocks.
2. **Collapse candidates from the same parent trait.** Per §3.2.1, multiple
   candidates may arise when a type satisfies several generic instantiations
   of the same parent trait (e.g., `From[i32]` and `From[i64]` both
   declaring `from`). The compiler treats these as one logical method
   parameterized by the trait's generic arguments. Disambiguation among
   them uses the call-site context — argument types, expected return type,
   explicit turbofish — exactly as for any other generic function dispatch
   per §2.2.5. The set of candidates after this collapse contains at most
   one parent-trait entry.
3. **At most one parent-trait candidate after collapse.** Per §3.2.1, no
   type may satisfy two traits with *different* parent identities that
   declare overlapping method names — the type's `satisfies` declaration
   would have been rejected. Therefore the trait-impl search yields either
   zero or one parent-trait candidate.
4. **One parent-trait candidate matches → resolve to it.** The trait impl
   wins over any same-named free function. A free function with the same
   name in scope is *shadowed* at this call site; it remains callable only
   via path qualification (e.g., `some_module::f(x, ...)`). Within the
   parent-trait candidate, if multiple generic instantiations are
   reachable, the compiler resolves to a specific instantiation by
   inference per §2.2.5; failure to resolve to one is a compile error at
   the call site asking for explicit disambiguation.
5. **No trait-impl candidate matches → fall back to free-function search.**
   The compiler looks in the current scope's free-function namespace for a
   function `f` whose first parameter type matches `x`'s type (or is reachable
   via implicit widening per §4.5).
6. **One free function matches → resolve to it.** Standard free-function
   dispatch.
7. **Multiple free functions in scope under the same local name is
   impossible.** Free functions are uniquely named within their module per
   §10 (Option E in Topics.md); only one can be in scope under any
   given local name. Cross-module conflicts are resolved at import time, not
   at call time.
8. **Nothing matches → unknown method error.** The diagnostic includes the
   receiver's type, the unmatched name, and any near-matches the compiler
   identified.

The algorithm is deterministic: §3.2.1's parent-trait collision rule
guarantees that any (type, method-name) pair has at most one parent-trait
source, and the §10 module rules guarantee that any given module-scope
name has at most one free-function source. When a parent-trait source has
multiple generic instantiations, disambiguation among them follows the
standard inference rules (§2.2.5).

Trait-path syntax (`Trait::f(x)`) remains available as the explicit form
when a user wants to make the call's trait source visible at the call
site, including disambiguation between generic instantiations via
turbofish (`Trait::[T]::f(x)`, see §3.4.1.1 below) or via path-qualified
type-side dispatch (`Type::f(x)`, where `Type` is the for-type of the
target `fulfill` block).

#### 3.4.1.1 Disambiguating generic trait instantiations

When a type satisfies multiple instantiations of the same parent trait
(e.g., `MyNumber` satisfies both `From[i32]` and `From[i64]`), bare-name
dispatch at `MyNumber::from(value)` typically resolves via the argument
type: if `value: i32`, the `From[i32]` instantiation is selected; if
`value: i64`, the `From[i64]` instantiation. The compiler uses the same
inference algorithm as for generic functions (§2.2.5).

When inference cannot uniquely determine the argument's type — for
instance, inside a generic function body where the argument has a
generic-parameter type — the compiler reports a call-site ambiguity
error. The user disambiguates explicitly using the trait-path form with
turbofish on the trait:

```
fn build[T](v: T) -> MyNumber where MyNumber: From[T]:
  From::[T]::from(v)       // T is generic; turbofish pins the instantiation
```

This is the turbofish form (§2.2.5) applied to the trait identity,
selecting a specific instantiation of the trait before resolving the
method.



Trait visibility matters for dispatch. A `fulfill T for X` block is reachable
for dispatch on `x: X` only when `T` itself is in scope (imported or
accessible by path). If `T` is not in scope, the implementation is invisible
at the call site, and the search proceeds as if that trait-impl candidate
did not exist. Users control which trait-impl candidates participate in
dispatch by choosing which traits to import.

Disambiguation forms:

- `Trait::f(x, ...)` — explicitly select a trait-impl candidate (the canonical
  way to resolve trait-vs-trait ambiguity in step 3).
- `some_module::f(x, ...)` — explicitly select a free function (used when a
  free function would otherwise be shadowed by a trait impl per step 2).
- `x >> Trait::f` — pipe-forward with trait-path qualification.
- `x.f::[T]()` is *not* a disambiguation form; the turbofish (§2.2.5)
  specifies generic type arguments, not the receiving trait.

#### 3.4.2 Dispatch at monomorphization

Trait method calls in monomorphized code resolve to direct function calls per
§2.3.5; coherence (§3.7) guarantees there is exactly one implementation to
dispatch to within a (trait, type) pair. The free-function vs trait-impl
namespace distinction is purely for *name resolution at call sites* — once
resolved, the call compiles to a direct function call to a specific function
identified by its fully-qualified path (module-path-or-trait-path + name).

### 3.5 Argument Forms

The language supports two forms for supplying arguments at any call site:
*positional* and *named*. The choice is per-call, not per-callee, with one
universal restriction: positional and named arguments cannot be mixed
within a single call.

#### 3.5.1 The two forms

**Positional form** — arguments are listed in declaration order, without
names:

```
let s = Shape::Rectangle(10.0, 20.0)
let c = clamp(temperature, 0, 100)
```

**Named form** — each argument is paired with its parameter name:

```
let s = Shape::Rectangle(width: 10.0, height: 20.0)
let c = clamp(value: temperature, lower: 0, upper: 100)
```

The named form uses `name: value` syntax. In the named form, the order of
arguments does not matter; the compiler matches by name. In the positional
form, arguments must appear in declaration order.

Both forms are valid for any single-argument call. `square(5)` and
`square(value: 5)` are equivalent; no special rule restricts single-
argument calls to one form.

A no-argument call (`person.display()`) is trivially both forms; the
parentheses are empty and no mixing question arises.

#### 3.5.2 No mixing within one call

A single call site uses either positional or named form throughout. Mixing
is a compile error:

```
Shape::Rectangle(width: 10.0, 20.0)       // ✗ mixed — compile error
add(3, right: 4)                          // ✗ mixed — compile error
```

The rule applies to every call: free functions, trait methods, variant
constructors, and any other invocation. The compiler reports the error at
the call site, identifying which argument breaks the pattern.

#### 3.5.3 Per-callable form constraints

Some declarations restrict the allowed form at their call sites:

- **Records** (§6.1.3) are *always* constructed with named arguments.
  Positional construction of records is a compile error.
- **Tuples** (§9) are *always* constructed positionally. Named
  construction of tuples is a compile error.
- **Newtypes** (§6.3.2) are *always* constructed positionally with one
  argument — the underlying value.
- **Free functions and trait methods** accept either form per-call.
  Parameters always have names (per §3.1.1), so both forms are available
  at every call site.
- **Enum variants** depend on the variant's declaration (§6.2.1):
  positionally-declared variants accept only positional form;
  named-declared variants accept both forms per-call.

The constraints reflect the nature of each declaration:

- *Records* are nominal product types whose fields are named for domain
  meaning. Forcing named construction makes the meaning of each value
  explicit at every construction site and prevents the
  same-typed-fields-in-wrong-order class of bugs (`Point(1.0, 2.0)` —
  which is `x` and which is `y`?). The verbosity is the cost; clarity is
  the benefit.
- *Tuples* are anonymous products whose fields have only positional
  identity — they have no names by design. Forcing positional
  construction preserves this anonymity; named construction would invent
  metadata that doesn't exist in the type.
- *Newtypes* wrap a single underlying value. The constructor takes one
  argument; the name would be redundant with the type name itself.
- *Enum variants* choose their available forms at the declaration site
  (§6.2.1). A positional declaration (`Some(T)`) commits to
  conciseness; a named declaration (`Rectangle(width: f64, height: f64)`)
  enables both forms for readability at call sites where names help.

For declarations that accept both forms, the choice between positional
and named at a call site is a style decision driven by readability. Long
argument lists, arguments with non-obvious meaning, or arguments using
defaults benefit from named form; short calls with self-evident argument
meaning benefit from positional form.

#### 3.5.4 Defaults and form interaction

Parameters with default values (per §6.1.2 for records and analogous
features for functions) interact with argument forms as follows:

- In **named form**, default-bearing parameters may be omitted. The
  default value applies for any parameter not named in the call.
- In **positional form**, parameters must be supplied in declaration order.
  Default-bearing parameters at the *end* of the parameter list may be
  omitted (the remaining defaults all apply). Default-bearing parameters
  in the *middle* of the list cannot be skipped — supplying a later
  parameter positionally requires supplying all earlier parameters
  positionally too.

```
fn greet(name: string, greeting: string = "Hello", suffix: string = "!"):
  ...

greet("Alice")                                  // ✓ uses both defaults
greet("Alice", "Hi")                            // ✓ uses suffix default
greet("Alice", "Hi", "?")                       // ✓ all positional
greet(name: "Alice", suffix: "?")               // ✓ named, skipping greeting
greet("Alice", suffix: "?")                     // ✗ mixed positional and named
```

The skipping flexibility of named form is one of its principal practical
advantages. Functions with many optional parameters typically benefit
from named form at call sites.

#### 3.5.5 Method calls and the receiver

A method call `x.f(args)` always passes the receiver `x` positionally
(per §3.4's uniform call syntax — the method call is sugar for `f(x,
args)`). The argument form rule applies to `args`, not to the receiver:

```
person.display()                                  // no args; trivially valid
shape.set_dimensions(width: 10.0, height: 20.0)   // named form for trailing args
shape.set_dimensions(10.0, 20.0)                  // positional form
shape.set_dimensions(10.0, height: 20.0)          // ✗ mixed
```

The receiver `x` is conceptually the first positional argument of the
underlying free function; the dot-syntax just brings it forward
syntactically.

#### 3.5.6 The `with` expression uses named form

The record-update `with` expression (§6.1.5) uses named form for its
field overrides:

```
let p2 = p1 with name: "new", age: 30
```

This is a special case of the general rule: records require named form
(§3.5.3); the `with` expression updates record fields and therefore
inherits the same form requirement. There is no positional `with` form.

#### 3.5.7 Argument forms in patterns

The same positional/named distinction applies to *patterns* that
destructure compound values (§6.2.4). Variant patterns may be positional
or named, parallel to variant construction; mixing within one pattern is
a compile error. Record patterns are always named; tuple patterns are
always positional.

This parallelism is structural: a pattern is a "call site for
destructuring," with the same argument-form rules as a call site for
construction.

### 3.6 Trait Hierarchies

Traits compose into hierarchies via `requires` clauses. The recommended
pattern, used pervasively in the language's standard library, is *fine-grained
operator/capability traits combined into umbrella traits*.

#### 3.6.1 The fine-grained-plus-umbrella pattern

Fine-grained traits each declare exactly one method or one closely related
group of methods, defining a single capability:

```
trait Add:
  type Output
  fn add(left: Self, right: Self) -> Output

trait Sub:
  type Output
  fn sub(left: Self, right: Self) -> Output

trait Mul:
  type Output
  fn mul(left: Self, right: Self) -> Output

trait Neg:
  fn neg(value: Self) -> Self
```

Umbrella traits combine fine-grained traits via `requires` clauses,
introducing no new methods. The numeric umbrellas follow this pattern;
canonical definitions appear in §4.9.2, abbreviated here as an
illustration:

```
@default(i32)
trait Numeric:
  requires Add, Sub, Mul, Zero, One, ...      // canonical: §4.9.2

@default(i32)
trait Integer:
  requires Numeric, IntDiv, Rem, ...          // canonical: §4.9.2

@default(f64)
trait Float:
  requires Numeric, Neg, Div, ...             // canonical: §4.9.2

@default(i32)
trait Signed:
  requires Integer, Neg, ...                  // canonical: §4.9.2

@default(u32)
trait Unsigned:
  requires Integer                            // Neg deliberately absent (§4.9.2)
```

The signed/unsigned split is structurally honest: `Neg` lives on `Signed`
and `Float`, not on `Numeric`. Unsigned integer types satisfy `Numeric`
and `Unsigned` but not `Neg`; this is what the umbrella's `requires` set
encodes. See §4.9.2 for the full umbrella definitions.

Per §3.3.5, umbrella traits are automatically satisfied when their
requirements are. Users implement the fine-grained traits for their types;
umbrella satisfaction follows.

Some fine-grained traits are deliberately *not* part of any numeric umbrella
because they are not numeric-specific. `Ord` (ordering) and `Eq` (equality)
are standalone fine-grained traits — non-numeric types (strings, enums,
records, user-defined types) may also be ordered or compared, so binding
`Ord` and `Eq` to the numeric hierarchy would either incorrectly require
non-numeric types to be numeric or fragment the standalone traits into
numeric and non-numeric versions. The clean answer: `Ord` and `Eq` stand on
their own; built-in numeric types implement both; the numeric umbrella traits
do not require them. A generic function needing both ordering and arithmetic
constrains as `T: Numeric & Ord`, combining the umbrella with the standalone
trait explicitly.

This pattern serves three purposes:

- *Precision in inferred constraints (§2.2.4):* the compiler infers exactly
  which fine-grained traits a function body requires, not a coarser umbrella
  the function might not actually need.
- *Convenience in explicit constraints:* users writing explicit bounds can use
  umbrella names (`T: Numeric`) without spelling out every operator, while
  still being able to write fine-grained bounds (`T: Add + Mul`) when
  precision matters.
- *A place for trait-level defaults:* umbrellas are the natural carrier of
  defaulting policy (§3.1.5), because the default is a property of the
  domain-level abstraction, not of any individual operator.

#### 3.6.2 Default trait selection in defaulting

When a use site is constrained by multiple traits each with declared defaults,
the most-specific trait in the hierarchy wins. "Most specific" is defined by
the `requires` relation: trait `A` is more specific than trait `B` if `A`
transitively requires `B` (i.e., `A` is "below" `B` in the hierarchy).

For example, a use site constrained by `Float` defaults to `f64` (the
`Float` trait's declared default), not `i32` (the `Numeric` trait's default),
because `Float` requires `Numeric` and is therefore more specific.

When multiple incomparable traits are in scope (neither requires the other)
and each has a declared default, the defaulting is ambiguous and the compiler
reports an error requiring an explicit annotation at the use site.

### 3.7 Coherence and Orphan Rules

Coherence is the property that for every (trait, type) pair, exactly one
implementation exists, reachable through the module graph. The language
enforces coherence structurally via the orphan rule.

#### 3.7.1 The strict orphan rule

A `fulfill Trait for Type` block is permitted in module M if and only if:

- `Trait` is defined in M, OR
- `Type` is defined in M.

A `fulfill` block where both `Trait` and `Type` are foreign to M is rejected
at compile time. This guarantees that no two independent modules can write
conflicting implementations for the same (trait, type) pair: at least one of
them would violate the orphan rule.

There are no exceptions for "private" or "non-exported" orphan implementations.
The privacy boundary cannot be enforced cleanly under separate compilation,
and the looser rules used in some languages produce confusing visibility
interactions. The strict rule is the only model that composes cleanly with
the language's separate compilation model (§2.3.2) and uniform call dispatch
(§3.4).

#### 3.7.2 Generic-parameter coverage

For impls involving type parameters, the orphan rule applies to the head of
the type expression: at least one *concrete local type* must appear in the
trait-or-type part of the `fulfill` declaration.

```
// Permitted in module M defining LocalType:
fulfill ForeignTrait[LocalType] for ForeignType: ...

// Rejected — no concrete local type:
fulfill ForeignTrait[T] for ForeignType: ...
```

The covering rule prevents two independent modules from each writing
`fulfill ForeignTrait[T] for ForeignType` with different unspecified `T`,
which would create conflicts at use sites.

#### 3.7.3 Language-privileged implementations

Certain implementations are provided by the language itself rather than by
user modules, and are not subject to the orphan rule:

- *Auto-implementations of built-in numeric traits for built-in numeric
  types.* The fine-grained operator traits (`Add`, `Sub`, `Mul`, etc.) are
  pre-implemented for the built-in numeric types. User code cannot redefine
  these.
- *Auto-derivations from `From` to `Into` and `TryFrom` to `TryInto`* (§7).
  When a user writes `fulfill From[T] for U`, the
  language automatically provides `Into[U] for T`. The derivation is built
  in, not user-writable.
- *Identity conversion `From[T] for T` for every type.* Universally provided.

These privileged implementations exist outside the user-writable
`fulfill`-block space and cannot conflict with user code.

#### 3.7.4 Newtype pattern as orphan-rule workaround

When a user wants to implement a foreign trait for a foreign type, the
canonical workaround is the newtype pattern: wrap the foreign type in a local
newtype, then implement the foreign trait for the local newtype:

```
type MyVec:
  satisfies SomeForeignTrait
  inner: Vec[i32]

fulfill SomeForeignTrait for MyVec:
  ...
```

`MyVec` is local to the user's module; the orphan rule is satisfied.
Newtype semantics are specified in §6.3.

### 3.8 Automatic Derivation (`@derive`)

For a fixed set of common traits, the language provides automatic structural
derivation via the `@derive` annotation (grammar §3.3). Applying `@derive` to
a type generates the appropriate `fulfill` blocks structurally, saving the
user from writing mechanical implementations.

#### 3.8.1 Derivable traits

The traits eligible for automatic derivation are:

- `Eq` — structural equality.
- `Ord` — structural total ordering.
- `Hash` — structural hashing.
- `Clone` — deep structural copy.
- `Display` — default human-readable formatting.
- `Debug` — default debug formatting (structural, compiler-defined).

The set is fixed in the language; users cannot register new traits for
`@derive`. Other traits require manual `fulfill` blocks. (A future extension
may add user-definable derivation; not in v1.)

#### 3.8.2 Structural derivation rules

For a record type, derivation operates field-by-field:

- `@derive(Eq)` generates an implementation that compares each field pairwise
  using that field type's own `Eq` implementation.
- `@derive(Ord)` generates lexicographic ordering by field declaration order.
- `@derive(Hash)` generates a hash combining each field's hash.
- `@derive(Clone)` generates a structural copy of each field.
- `@derive(Display)` generates a default record-formatted string (exact format
  is compiler-defined).
- `@derive(Debug)` generates a structural debug format.

For an enum type, derivation operates variant-by-variant:

- `@derive(Eq)` generates an implementation that compares variant tags and,
  for matching tags, compares payload fields pairwise.
- `@derive(Ord)` orders by variant declaration order, breaking ties by
  payload comparison.
- The other derivations follow the same structural pattern.

For a newtype (§6.3), `@derive` may delegate to the underlying type
or operate structurally over fields, depending on the newtype's shape; see
the newtype section for details.

Derivation requires every field's (or payload's) type to itself satisfy the
trait being derived. `@derive(Eq)` on `type Foo: x: SomeType` requires
`SomeType: Eq`. If any component type does not satisfy the trait, derivation
fails with a compile error identifying the offending component.

#### 3.8.3 Overriding derived implementations

A type may both `@derive` a trait and provide a manual `fulfill` block for
the same trait. The manual `fulfill` block takes precedence; the derived
implementation is suppressed for that (trait, type) pair.

This allows users to start with derived defaults and override specific
implementations as needed without removing the `@derive` annotation.

---

## 4. Numeric System

This section specifies the language's numeric primitive types, literal forms,
operator semantics, conversion rules, overflow handling, and the trait
hierarchy that underpins generic numeric code. The trait machinery in §3
provides the abstraction layer; this section provides the concrete numeric
content.

### 4.1 Numeric Primitive Types

The built-in numeric primitive type set is fixed at fourteen types.

**Signed integers:**

| Type | Width | Range |
|---|---|---|
| `i8` | 8-bit | −128 to 127 |
| `i16` | 16-bit | −32,768 to 32,767 |
| `i32` | 32-bit | −2³¹ to 2³¹ − 1 |
| `i64` | 64-bit | −2⁶³ to 2⁶³ − 1 |
| `i128` | 128-bit | −2¹²⁷ to 2¹²⁷ − 1 |
| `isize` | platform-pointer-sized | platform-dependent |

**Unsigned integers:**

| Type | Width | Range |
|---|---|---|
| `u8` | 8-bit | 0 to 255 |
| `u16` | 16-bit | 0 to 65,535 |
| `u32` | 32-bit | 0 to 2³² − 1 |
| `u64` | 64-bit | 0 to 2⁶⁴ − 1 |
| `u128` | 128-bit | 0 to 2¹²⁸ − 1 |
| `usize` | platform-pointer-sized | platform-dependent |

**Floating-point:**

| Type | Format | Range/Precision |
|---|---|---|
| `f32` | IEEE 754 single | ~7 decimal digits, ±3.4 × 10³⁸ |
| `f64` | IEEE 754 double | ~16 decimal digits, ±1.8 × 10³⁰⁸ |

`i128` and `u128` are first-class. The performance overhead on platforms
without native 128-bit hardware is bounded (software emulation, ~3–5× a
64-bit op) and paid only when used; the alternatives — standard-library
big-integer types or manual u64 pairs — are dramatically worse ergonomically
for the legitimate use cases (UUIDs, cryptography, high-precision fixed-point,
financial domains beyond 64-bit range).

`isize` and `usize` are platform-sized integers. They are distinct types
serving distinct roles: `isize` is the array-length and index type
(§9.3); `usize` exists for FFI compatibility with C-family `size_t`
APIs, byte-count contexts where the non-negative invariant is load-bearing,
and low-level memory layout work. Most code uses `isize`; `usize` appears in
low-level corners.

Half-precision (`f16`) and quadruple-precision (`f128`) floats are not
included in v1. Hardware support for `f16` remains uneven across target
platforms, and many of the special numeric operations (§4.6) would require
fallback through `f32`. `f128` is highly specialized; the rare cases
needing it are adequately served by standard-library arbitrary-precision
types.

### 4.2 Type Aliases

The standard library provides convenience aliases using the `alias type`
mechanism (Topic 18 in the decision log; see §6.3 for newtypes, which
contrast with `alias type`):

```
alias type byte = u8
alias type short = i16
alias type int = i32
alias type long = i64
alias type double = f64
```

These are true aliases — transparent substitution, shared identity, fully
interchangeable with the underlying type at every use site. A value of type
`int` *is* a value of type `i32`; the alias adds no new identity, no new
trait impls, no conversion cost. Aliases are provided for users who prefer
C-traditional names; the canonical explicit-width names remain the
language's primary identifiers and appear unaltered throughout the standard
library and documentation.

No alias for `f32` is provided. The natural C-traditional name `float` would
conflict with the lowercase `float` placeholder keyword (§1.4 and §2.2.4)
and would mislead users from C-family languages
where `float` is single-precision. `double` is the canonical short name for
`f64`; users wanting `f32` write `f32` directly.

No alias is provided for `i128`, `u128`, `isize`, `usize`, `i8`, `u16`,
`u32`, or `u64` — these types have no widely-shared traditional short name
across language families, and the explicit-width names are clearer than any
alias would be.

Users may define their own aliases anywhere using the same `alias type`
syntax. The built-in aliases are a stdlib convenience; nothing about them is
privileged.

### 4.3 Numeric Literals

Literal forms follow grammar §2.5.

#### 4.3.1 Integer literals

Integer literals are written in decimal, hexadecimal (`0x` prefix), octal
(`0o` prefix), or binary (`0b` prefix). Underscores are permitted between
digits as visual separators:

```
42
1_000_000
0xFF_FF
0b1010_1100
0o755
```

An integer literal may carry an explicit type suffix, separated by an
underscore:

```
5_i32
255_u8
1_000_000_u32
0xFF_u8
```

The suffix forces the literal to the specified type, bypassing both the
placeholder mechanism (§2.1) and the trait-level default (§3.1.5). The
value-fits check from §2.4.3 still applies: a suffix specifying a type the
value doesn't fit (`300_u8`) is a compile error.

Without a suffix, an integer literal produces a value with the *integer
placeholder*. Resolution proceeds per §2.1 (use-site resolution, with
cross-kind permitted when the value fits exactly per §2.4.3).

#### 4.3.2 Float literals

Float literals require at least one of: a decimal point with digits, an
exponent (`e` or `E`), or an explicit float suffix:

```
3.14
1.0
1e6
2.5e-3
6.022_e23
```

A bare `1` is an integer literal; `1.0`, `1e5`, `1_f32` are float literals.
The grammar requires a digit on each side of the decimal point — leading-dot
forms like `.5` are not permitted; write `0.5`.

Float literals may carry suffixes:

```
3.14_f32
3.14_f64
1.0_f32
6.022e23_f64
```

Without a suffix, a float literal produces a value with the *float
placeholder*. Resolution proceeds per §2.1; the default per §3.1.5 is `f64`.

#### 4.3.3 Boolean and character literals

`true` and `false` are the two values of `bool` (§9.1.1). They
are not numeric; they do not participate in the numeric trait hierarchy.

Character literals (`'a'`) produce values of type `char` (32-bit Unicode
scalar value); byte literals (`b'a'`) produce values of type `u8`. Per
§9.1.2, `char` is not numeric; `u8` from a byte literal is
fully numeric (it is u8 in every type-system sense).

### 4.4 Operator Semantics

Operators on numeric values follow the rules in this section. Each operator
corresponds to one or more trait methods in §4.9's trait hierarchy.

#### 4.4.1 Arithmetic operators

| Operator | Operand Constraint | Result | Notes |
|---|---|---|---|
| `+` | `Add` | same kind | mixed-kind promotes per §4.5 |
| `-` (binary) | `Sub` | same kind | mixed-kind promotes per §4.5 |
| `*` | `Mul` | same kind | mixed-kind promotes per §4.5 |
| `/` | `Numeric` | **always Float** | mathematical division; see §4.4.1.1 |
| `//` | `IntDiv` | Integer | truncating integer division |
| `%` | `Rem` | same kind | mixed-kind promotes per §4.5 |
| `-` (unary) | `Neg` | same as operand | type error on unsigned |

##### 4.4.1.1 The `/` operator and integer-to-float promotion

The `/` operator is mathematical division, divorced from machine
representation. It accepts `Numeric` operands (integer, float, or mixed)
and always produces a `Float` result. `5 / 2` produces `2.5`, not `2`. The
result type is determined by the operator itself, not by the operand types:
even uniformly-integer operands (`10_i32 / 5_i32`) produce a `Float`, not
an integer.

The mechanism is a language-level rule applied at the operator, distinct
from direct trait dispatch:

1. The compiler verifies both operands satisfy `Numeric` (per §3.6).
2. If either operand is `Integer`-kinded (or both are), the compiler
   inserts implicit widening conversions to lift them to the appropriate
   `Float` type per §4.5's lossless-widening rules. The pragmatic
   exception for `i64`/`u64` → `f64` (§4.5.2) applies here too.
3. The promoted operands then satisfy `Div` (which is declared only on
   `Float`); the compiler dispatches `Div::div` on the float type.
4. The result is a `Float` value of the type the operands were widened to.

Examples:

```
5_i32 / 2_i32          // both i32 → both widen to f64 → 2.5_f64
3.14_f32 / 2_i32       // i32 widens to f64; f32 widens to f64 → ~1.57_f64
5_i64 / 2_i64          // both i64 → both widen to f64 (pragmatic exception) → 2.5_f64
5.0_f64 / 2.0_f64      // both f64 → direct Div::div → 2.5_f64
```

The choice of which float type to widen to follows §4.5's mixed-kind rules:
the smaller integer widens to whichever float type matches the larger
operand, or to the default `f64` if both operands are integers without an
overriding context. Concretely:

- `i8`/`u8`/`i16`/`u16` operands widen to `f32` if the other operand is
  `f32`, or to `f64` otherwise (default and exact-representable).
- `i32`/`u32` operands widen to `f64` (exact-representable; `f32` would
  lose precision).
- `i64`/`u64` operands widen to `f64` (pragmatic exception; precision may
  be lost for values above 2⁵³).
- `i128`/`u128` operands: implicit widening is *not* permitted by §4.5;
  `/` on `i128`/`u128` operands requires an explicit cast to float first.
  The operator does not silently lose precision at the 128-bit boundary
  where the precision loss is dramatic.

If neither operand pins the float type and both are integers, the result is
a `Float`-placeholder value (§2.1) that resolves per §3.1.5's default
(`f64`) unless context demands otherwise.

This rule is the *only* place in the language where an operator performs
implicit kind-crossing promotion on uniformly-integer operands. Every other
operator with mixed-kind support requires at least one operand to already
be of the target kind; `/` is unique in always producing float regardless
of input kinds.

##### 4.4.1.2 Other arithmetic operators

`//` is the truncating integer division operator. It accepts `Integer`
operands and produces an `Integer` result. `5 // 2` produces `2`; `-5 // 2`
produces `-3` (toward negative infinity). `Float` operands are a type error.
For float-input integer-output behavior, the user explicitly converts via
`as` or `From`/`Into`.

`%` (remainder) accepts both kinds and produces a result of the same kind
as its operands. Mixed-kind operands promote per §4.5.

Unary `-` is defined on signed integers and floats only. Applying unary `-`
to an unsigned integer is a type error at compile time — silent wrap on
negation is rejected as a footgun source. To compute the additive inverse of
an unsigned value, the user explicitly converts to a signed type via `as`
or `From`/`Into` per §7.

Negative integer literals (e.g., `-5` in `let x: i8 = -5`) are not subject
to the unary-minus-on-unsigned rule. Per §2.4.5, `-N` is parsed as a single
signed literal token at type-check time, not as the unary operator applied
to a positive literal. The unary-minus rule applies only to runtime values
of unsigned type, never to literals at their declaration site.

#### 4.4.2 Bitwise operators

| Operator | Operand Trait | Result |
|---|---|---|
| `&` | `BitAnd` | Integer (same type) |
| `\|` | `BitOr` | Integer (same type) |
| `^` | `BitXor` | Integer (same type) |
| `~` (unary) | `BitNot` | Integer (same type) |
| `<<` | `Shl` | Integer (same type as left operand) |
| `>>` | `Shr` | Integer (same type as left operand) |

Bitwise operators are integer-only. Applying them to float values is a type
error. Bit-level operations on floats require an explicit reinterpret cast
through `as` to an integer type of the same width.

The `&` and `|` characters are reused at the type level (`&` for trait
intersection per §5, `|` for placement-attribute pipes per grammar §3.10
and for enum sum types per grammar §3.6). At the value level — that is,
inside expressions — they are bitwise operators. The grammar's context-based
disambiguation determines which interpretation applies; user-visible
overloading is avoided through positional context.

The right-shift operator `>>` is a single operator whose behavior depends
on the signedness of the left operand's type: signed types shift
arithmetically (sign-extending); unsigned types shift logically (zero-
extending). The compiler dispatches on the type via the `Shr` trait impl.
No separate `>>>` operator exists.

The grammar currently assigns `>>` to pipe-forward (§3.15.3). The
expression-position bitwise meaning coexists with the pipe-forward meaning
via context-directed dispatch: when the right-hand side resolves to a
callable expression (a function reference, a path to a function, a method
reference), `>>` is pipe-forward and means "call the RHS with the LHS as
argument" (§3.4). When the right-hand side resolves to a numeric
expression, `>>` is bitwise right-shift dispatching through `Shr`. The
disambiguation is by what the RHS resolves to during type-checking, not
by surface syntax alone. This is the same mechanism that disambiguates
`&` and `|` between type-level and value-level uses.

#### 4.4.3 Comparison operators

| Operator | Operand Trait | Result |
|---|---|---|
| `<` | `Ord` | bool |
| `<=` | `Ord` | bool |
| `>` | `Ord` | bool |
| `>=` | `Ord` | bool |

Comparison works on both integer and float kinds. Mixed-kind comparisons
promote per §4.5 before comparing. Float comparison follows IEEE 754
semantics including NaN behavior: `NaN < x` is `false`, `NaN > x` is `false`,
`NaN == NaN` is `false` (via the `is` operator below). This is a property of
IEEE 754, not a language design choice; user code working with potentially-
NaN floats must handle the NaN cases explicitly.

Comparison chaining (`a < b < c`) is not permitted (grammar §3.15 admits the
syntax but the type system rejects it: only the rightmost comparison is
typechecked as boolean-returning; intermediate comparisons in a chain would
produce a bool which then doesn't compare meaningfully with the next
operand).

#### 4.4.4 Equality operators

| Operator | Operand Trait | Result |
|---|---|---|
| `is` | `Eq` | bool |
| `is not` | `Eq` | bool |

Equality uses the keyword forms `is` and `is not`, not symbolic `==`/`!=`
(grammar §3.15 and grammar §6 reserve symbolic equality for future
deprecation). The keyword forms read more naturally in this language's
expression syntax and avoid the visual collision with `=` used for
binding-initialization.

Equality works on both integer and float kinds. Mixed-kind equality
promotes per §4.5 before comparing.

Float equality is permitted despite the precision hazards of IEEE 754
(`0.1 + 0.2 is not 0.3`). The alternative — removing `is`/`is not` from
floats and forcing epsilon comparison — is paternalistic and breaks
legitimate uses (NaN checks via `x is not x`, exact-zero comparisons,
comparisons against known-exact values). The hazard is documented; users
needing approximate comparison call stdlib `approx_eq(a, b, epsilon)` or
similar.

#### 4.4.5 Mixed-kind promotion (overview)

When an expression mixes integer and float operands, the integer operand
widens implicitly to the float type before the operation proceeds. Full
widening rules — both integer-to-integer and integer-to-float — are
specified in §4.5.

#### 4.4.6 Operator-to-inferred-constraint mapping

When the compiler infers constraints from a generic function body per
§2.2.2, each operator implies a specific trait constraint on its operands
(and on the result type where the operator produces a constrained result).
This table specifies the mapping:

| Operator | Operand constraint | Result constraint |
|---|---|---|
| `+` | `Add` | same type as operands |
| `-` (binary) | `Sub` | same type as operands |
| `*` | `Mul` | same type as operands |
| `/` | `Numeric` | `Float` (per §4.4.1.1) |
| `//` | `IntDiv` | same type as operands |
| `%` | `Rem` | same type as operands |
| `-` (unary) | `Neg` | same type as operand |
| `&` | `BitAnd` | same type as operands |
| `\|` | `BitOr` | same type as operands |
| `^` | `BitXor` | same type as operands |
| `~` | `BitNot` | same type as operand |
| `<<` | `Shl` (left); `u32`-convertible (right) | same type as left operand |
| `>>` | `Shr` (left); `u32`-convertible (right) | same type as left operand |
| `<`, `<=`, `>`, `>=` | `Ord` | `bool` |
| `is`, `is not` | `Eq` | `bool` |
| `+%`, `-%` (binary), `*%`, `//%`, `%%` | corresponding `Wrapping...` | same type as operands |
| unary `-%` | `WrappingNeg` | same type as operand |
| `+\|`, `-\|` (binary), `*\|`, `//\|`, `%\|` | corresponding `Saturating...` | same type as operands |
| unary `-\|` | `SaturatingNeg` | same type as operand |
| `+?`, `-?` (binary), `*?`, `//?`, `%?` | corresponding `Checked...` | `Option[T]` |
| `/?` | `CheckedDiv` (on `Float`) | `Option[Float]`; integer operands widen per §4.4.1.1 |
| unary `-?` | `CheckedNeg` | `Option[T]` |
| `as` | (language-level) | the target type, traps on out-of-range |
| `as%` | `WrappingAs[T]` (operand) | the target type T |
| `as\|` | `SaturatingAs[T]` (operand) | the target type T |
| `as?` | `CheckedAs[T]` (operand) | `Option[T]` |

The compiler's inference algorithm per §2.2.1 walks each function body
collecting the union of these constraints across all operators used. The
resulting set is attached to the generic signature; call sites must satisfy
it. The umbrella traits from §4.9.2 may be substituted for sets of
fine-grained constraints when the substitution is unambiguous, for
readability in error messages and signatures.

For example, the body `a + (b - a) * c` infers `Add`, `Sub`, `Mul` on the
operand types (with the substitution rule that `a`, `b`, `c` are likely
related by inference — see §2.2.3). The compiler may report the inferred
bounds as `T: Numeric` rather than `T: Add + Sub + Mul + ...` when the
umbrella is unambiguous, but the underlying constraints are the
fine-grained traits per the operators used.

### 4.5 Implicit Widening

Implicit widening converts a narrower numeric value to a wider type
automatically, without an explicit cast, when the conversion is provably
lossless. All other conversions — narrowing, signed/unsigned crossing,
precision-losing — require explicit `as` (§4.7) or `From`/`Into` (§7).

The general principle: implicit widening fires only when the conversion
loses no information, with one pragmatic exception specified in §4.5.4.

#### 4.5.1 Integer-to-integer widening

| From | To | Implicit |
|---|---|---|
| `i8` → wider signed | `i16`, `i32`, `i64`, `i128`, `isize` | ✓ |
| `u8` → wider unsigned | `u16`, `u32`, `u64`, `u128`, `usize` | ✓ |
| `u8` → wider signed | `i16`, `i32`, `i64`, `i128`, `isize` | ✓ (always representable) |
| same-width signed/unsigned (e.g. `i32` ↔ `u32`) | the other | ✗ (explicit cast) |
| signed → wider unsigned (e.g. `i8` → `u16`) | wider unsigned | ✗ (negatives don't fit) |
| any narrowing | narrower type | ✗ (range may not fit) |

The principle: same-signedness widening is implicit; unsigned-to-wider-signed
is implicit (always representable). Crossing signedness boundaries — even
when widening — requires an explicit cast, because the bit pattern's
interpretation changes (an unsigned value might not fit a signed range of
the same width; a negative signed value cannot represent in any unsigned
type).

#### 4.5.2 Integer-to-float widening

| From | To | Implicit |
|---|---|---|
| `i8`, `u8`, `i16`, `u16` | `f32` | ✓ (8/16-bit fits in f32's 24-bit mantissa) |
| `i8`, `u8`, `i16`, `u16`, `i32`, `u32` | `f64` | ✓ (up to 32-bit fits in f64's 53-bit mantissa) |
| `i32`, `u32` | `f32` | ✗ (precision loss above 2²⁴) |
| `i64`, `u64` | `f64` | ✓ (pragmatic exception — see §4.5.4) |
| `i64`, `u64` | `f32` | ✗ (significant precision loss) |
| `i128`, `u128` | any float | ✗ (significant precision loss) |

The rule: integer-to-float widening is implicit when the integer's full
range fits exactly in the float's mantissa. `f32` has a 24-bit mantissa, so
integer widths up to 16-bit are exactly representable; `f64` has a 53-bit
mantissa, so integer widths up to 32-bit are exactly representable.

#### 4.5.3 Float-to-float widening

| From | To | Implicit |
|---|---|---|
| `f32` | `f64` | ✓ (exact-representable for all finite f32 values) |
| `f64` | `f32` | ✗ (precision and range loss) |

Float-to-float widening is implicit upward only. Narrowing from `f64` to
`f32` requires an explicit cast because both precision (mantissa width) and
range (exponent width) shrink.

#### 4.5.4 The i64/u64 → f64 pragmatic exception

`i64`/`u64` → `f64` is permitted as an implicit widening despite the formal
precision hazard for values above 2⁵³. The alternative — explicit casts on
every common `i64 + f64` expression — is more friction than the bounded
hazard justifies. The precision behavior is documented; users handling very
large integer magnitudes in float contexts are expected to be aware that
values exceeding 2⁵³ may lose low-order bits when converted to `f64`.

This is the only deviation from strict lossless widening. All other
precision-losing conversions require explicit casts.

#### 4.5.5 What requires explicit cast

Conversions not in §4.5.1–§4.5.3's implicit-widening tables require explicit
`as` (§4.7) or, for fallible conversions where the destination range might
not contain the source value, `TryFrom`/`TryInto` (§7) returning `Result`.

This includes: narrowing in either kind (wider-to-narrower integer,
wider-to-narrower float); signed/unsigned crossings of any width;
float-to-integer in any direction; precision-losing integer-to-float
(except the §4.5.4 exception); and any cross-type conversion involving
user-defined types via `From`/`Into`.

#### 4.5.6 Application: mixed-kind operators

The implicit-widening rules above are what makes mixed-kind operator
behavior work without explicit casts. For arithmetic operators (`+`, `-`,
`*`, `%`) with mixed-kind operands, the compiler applies the appropriate
widening from §4.5.1–§4.5.4 to bring operands to a common type, then
dispatches the operator's trait method on that type. For `/` specifically,
the operator's always-float result triggers integer-to-float widening even
for uniformly-integer operands per §4.4.1.1.

For comparison and equality operators (`<`, `<=`, `>`, `>=`, `is`,
`is not`), mixed-kind operands are widened the same way before comparison.

### 4.6 Overflow and Arithmetic Safety

Arithmetic operators have four variants per operation, expressing four
different policies for handling out-of-range results.

#### 4.6.1 Default trap-on-overflow

The default arithmetic operators (`+`, `-`, `*`, `/`, `//`, `%`, unary `-`)
trap on overflow at runtime, in all build modes. There is no debug-traps/
release-wraps distinction.

When an operation produces a result outside the destination type's range, the
runtime halts with a diagnostic identifying the operation, the operand
values, and the source location. Traps cannot be caught as values — see §8.

The performance cost of overflow checking on modern hardware is bounded
(a well-predicted branch per operation). The cost is accepted in exchange
for uniform semantics, safety in production, and the property that "this
code worked in testing" implies "this code is correct in production" for
overflow concerns.

#### 4.6.2 Wrapping operators

Wrapping operators perform modular two's-complement arithmetic, silently
wrapping on overflow:

| Operator | Trait | Behavior |
|---|---|---|
| `+%` | `WrappingAdd` | `255_u8 +% 1 == 0_u8` |
| `-%` | `WrappingSub` | `0_u8 -% 1 == 255_u8` |
| `*%` | `WrappingMul` | `200_u8 *% 2 == 144_u8` |
| `//%` | `WrappingIntDiv` | `(-128_i8) //% (-1_i8) == -128_i8` (no overflow trap) |
| `%%` | `WrappingRem` | rare; defined for completeness |
| unary `-%` | `WrappingNeg` | `(-128_i8) -% == -128_i8` (no overflow trap) |

Wrapping is the right choice for hash functions, cryptographic primitives,
counters where modular arithmetic is the intent, and bit-manipulation
patterns where wrap is mathematically meaningful.

Integer-division wrapping (`//%`) handles the one case where integer
division overflows: signed-minimum divided by `-1` (e.g., `i32::MIN // -1`,
which mathematically would be `2³¹` but doesn't fit in `i32`). The
wrapping form yields `i32::MIN` itself (the bit pattern wraps).

There is no `/%` for the `/` operator because `/` always produces `Float`
per §4.4.1.1, and float operations follow IEEE 754 (which doesn't
trap-overflow). No `//%` variant exists for division by zero — there is no
sensible modular answer to "divide by zero"; use `//?` (§4.6.4) for the
recoverable form, or accept that `//%` on a zero divisor traps.

#### 4.6.3 Saturating operators

Saturating operators clamp to the destination type's range bounds on
overflow:

| Operator | Trait | Behavior |
|---|---|---|
| `+|` | `SaturatingAdd` | `255_u8 +\| 1 == 255_u8` |
| `-|` | `SaturatingSub` | `0_u8 -\| 1 == 0_u8` |
| `*|` | `SaturatingMul` | `200_u8 *\| 2 == 255_u8` |
| `//|` | `SaturatingIntDiv` | `(-128_i8) //\| (-1_i8) == 127_i8` |
| `%|` | `SaturatingRem` | rare; defined for completeness |
| unary `-|` | `SaturatingNeg` | `(-128_i8) -\| == 127_i8` |

Saturation is the right choice for DSP (audio sample clamping), image
processing (pixel value clamping), and any context where producing a
boundary value is preferable to either trapping or wrapping.

Integer-division saturation (`//|`) clamps the signed-min-divide-by-neg-one
overflow case to the type's maximum value, parallel to `//%`'s wrapping
behavior.

There is no `/|` for the `/` operator (same reasoning as `/%` above).
Saturating division by zero is not defined; use `//?` for the recoverable
form.

#### 4.6.4 Checked operators

Checked operators return `Option[T]` rather than producing a value-or-trap:

| Operator | Trait | Return | Behavior |
|---|---|---|---|
| `+?` | `CheckedAdd` | `Option[T]` | `Some(result)` or `None` |
| `-?` | `CheckedSub` | `Option[T]` | `Some(result)` or `None` |
| `*?` | `CheckedMul` | `Option[T]` | `Some(result)` or `None` |
| `/?` | `CheckedDiv` | `Option[Float]` | `None` on NaN/Infinity result; integer operands widen to float per §4.4.1.1 |
| `//?` | `CheckedIntDiv` | `Option[T]` | `None` on overflow or div-by-zero |
| `%?` | `CheckedRem` | `Option[T]` | `None` on overflow or zero divisor |
| unary `-?` | `CheckedNeg` | `Option[T]` | `None` on overflow |

The `/?` operator parallels `/` in widening behavior: integer operands
widen to float per §4.4.1.1, then dispatch to `CheckedDiv` on the float
type, returning `Option[Float]`. On float operands, the result is `None`
when IEEE 754 would produce `NaN` or `±Infinity` (e.g., divide by zero
producing `Infinity`, or `0.0/0.0` producing `NaN`); otherwise `Some(result)`.

The checked form is for cases where the caller wants to handle the
overflow or non-finite case explicitly without panicking. The `?` postfix
operator (§8) propagates the `None` upward in a function returning
`Option`-compatible types, making the recoverable-error chain ergonomic.

There are no `/%` or `/|` operators — wrapping and saturating
interpretations on float values would conflict with IEEE 754's
established semantics. Wrapping/saturating integer division uses `//%`
and `//|` per §4.6.2 and §4.6.3.

#### 4.6.5 Compile-time constant overflow

Compile-time constant overflow is always a compile error, regardless of
which operator variant is used. The compiler evaluates constant expressions
per §2.4 and rejects programs where a constant value provably doesn't fit
its declared or inferred type:

```
const x: u8 = 200_u8 + 100_u8                 // compile error: 300 doesn't fit u8
const x: u8 = 200_u8 +% 100_u8                // compile error: still doesn't fit
let arr: i32[some_large_compile_time_value]   // compile error if value doesn't fit isize
```

This applies to `+%`, `+|`, `+?` and other variants too: the compile-time
analysis happens before the runtime semantics of each variant matters.
Compile-time-known overflow is a programmer error to be fixed in code, not
a runtime condition to be handled.

#### 4.6.6 Float overflow

Float operations follow IEEE 754 semantics. Overflow produces signed
infinity (`f64::INFINITY` or `f64::NEG_INFINITY`); underflow may produce
subnormals or signed zero. NaN propagates through operations involving NaN
operands.

Float operators do not have wrapping or saturating variants — IEEE 754's
infinity-and-NaN semantics already define the overflow behavior, and
modular or clamping interpretations on float values would conflict with the
established standard. The checked variant `+?` etc. on floats is defined for
parity with integer checked operators and returns `None` if the operation
produces NaN or infinity (implementation detail to be confirmed when stdlib
is specified).

#### 4.6.7 Integer division by zero

Integer division by zero traps at runtime, per the default trap-on-overflow
philosophy. There is no sensible mathematical result for `n / 0` or `n // 0`
with integer types.

The checked variant `/?` (and `//?`) returns `None` for division by zero,
providing the recoverable form. There is no wrapping or saturating variant
for division by zero — no modular or clamping value is meaningful.

### 4.7 Explicit Casts

The `as` operator performs explicit numeric conversion. Like arithmetic
operators (§4.6), `as` has four variants expressing four different
out-of-range policies. The unsuffixed form is the default; suffixed forms
mirror the arithmetic operator suffixes.

#### 4.7.1 The four cast variants

| Operator | Trait | Behavior on out-of-range |
|---|---|---|
| `as` | (language-level) | trap at runtime |
| `as%` | `WrappingAs[T]` | modular two's-complement wrap |
| `as\|` | `SaturatingAs[T]` | clamp to destination type's range bounds |
| `as?` | `CheckedAs[T]` | return `Option[T]` — `None` on out-of-range |

Examples:

```
let x: i32 = 300
let y: u8 = x as u8                  // ✗ traps at runtime — 300 doesn't fit u8
let y: u8 = x as% u8                 // ✓ wraps: 300 mod 256 == 44
let y: u8 = x as| u8                 // ✓ saturates to u8::MAX == 255
let y: Option[u8] = x as? u8         // ✓ None — out of range
let z: i32 = some_float as i32       // truncating float-to-int (may trap)
```

The trapping default matches §4.6.1's philosophy: in production code,
out-of-range cast is a bug to be surfaced, not silently transformed. Users
who want non-trapping behavior choose the appropriate variant explicitly.

#### 4.7.2 Lossless casts

For widening casts that are lossless per §4.5, `as` is the explicit-syntax
equivalent of implicit widening — the same result, no runtime cost beyond
the conversion itself. The variants (`as%`, `as|`, `as?`) on lossless
casts are equivalent to `as` (no out-of-range case can arise); they remain
syntactically valid for use in generic code where the cast's losslessness
isn't statically known.

#### 4.7.3 Float-to-integer casts

Float-to-integer casts via `as` truncate toward zero (matching most
language conventions). Out-of-range float values (NaN, infinity, values
larger than the integer's range) follow the variant's policy: `as` traps,
`as%` is implementation-defined (truncation modulo the destination range
is the typical choice), `as|` saturates to the destination's range bounds
(NaN treated as 0), `as?` returns `None`.

#### 4.7.4 Trait-based forms

Each operator variant has a corresponding trait method per §4.9.1:
`WrappingAs::wrapping_as`, `SaturatingAs::saturating_as`, `CheckedAs::checked_as`.
The methods are callable via uniform call syntax (§3.4) and produce the
same results as the operators:

```
let y: u8 = x.wrapping_as::[u8]()        // equivalent to `x as% u8`
let y: u8 = x.saturating_as::[u8]()       // equivalent to `x as| u8`
let y: Option[u8] = x.checked_as::[u8]()  // equivalent to `x as? u8`
```

The operators are the canonical user-facing form; the trait methods exist
for generic code that constrains on the trait, and as the underlying
dispatch targets the operators desugar to.

#### 4.7.5 `as` reserved for built-in numeric and newtype operations

`as` is reserved for two purposes:

- Built-in numeric conversion (§4.7.1–§4.7.4).
- Newtype extraction (§6.3.2).

These are dispatched by operand kind: a numeric primitive on the left side
uses the numeric-cast machinery; a newtype on the left side uses extraction.
User-defined conversions on non-newtype types go through the
`From`/`Into`/`TryFrom`/`TryInto` traits per §7. The `as` operator does
not extend to arbitrary user-defined conversions.

### 4.8 Special Numeric Operations

Operations beyond the core arithmetic operators (mathematical functions,
inspection methods, constants) are provided as trait methods on the relevant
numeric traits. Per §3.4 they are callable via method-call, pipe-forward,
conventional, and trait-path syntax.

#### 4.8.1 General numeric operations

Available on all `Numeric` types (both integer and float):

| Operation | Trait | Signature |
|---|---|---|
| `abs` | `Abs` | `fn abs(value: Self) -> Self` |
| `min` | `Min` | `fn min(a: Self, b: Self) -> Self` |
| `max` | `Max` | `fn max(a: Self, b: Self) -> Self` |

Note on `abs`: applying `abs` to the minimum value of a signed integer type
(e.g., `i32::MIN.abs()`) traps on overflow per §4.6.1, because the
mathematical result (`2³¹`) doesn't fit in `i32`. The wrapping and
saturating variants are available as methods: `wrapping_abs`, `saturating_abs`.

`min` and `max` on floats are NaN-propagating by default. If either operand
is NaN, the result is NaN. This is consistent with every other float
operation in the language: any operation involving NaN produces NaN ("if
NaN in, NaN out"). Users with NaN-bearing data who want NaN to be ignored
in favor of the non-NaN operand opt in explicitly via `min_or` and `max_or`
(returning the non-NaN operand when exactly one is NaN, and NaN when both
are NaN).

This default aligns with IEEE 754-2019's recommended `minimum`/`maximum`
operations. The earlier IEEE 754-2008 `minNum`/`maxNum` operations (which
were NaN-suppressing) were deprecated in 2019 due to subtle issues with
negative zero and signaling NaN handling; the NaN-propagating form is now
the recommended primary behavior. The `min_or`/`max_or` variants implement
the older NaN-suppressing convention for data-processing use cases where
NaN represents missing data.

#### 4.8.2 Float-only operations

Available on `Float` types:

| Category | Operations |
|---|---|
| Square root | `sqrt` |
| Trigonometric | `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `atan2` |
| Logarithmic | `ln`, `log2`, `log10`, `log` (base, value) |
| Exponential | `exp`, `exp2` |
| Rounding | `floor`, `ceil`, `round`, `trunc` |
| Inspection | `is_nan`, `is_infinite`, `is_finite`, `is_normal` |

Each operation has its own trait (e.g., `Sqrt`, `Sin`, `Floor`). The
`Float` umbrella requires all of them per the umbrella pattern in §3.6.

Logarithm naming follows a deliberate convention to avoid the natural-vs-
base-10 ambiguity that plagues other languages: no bare `log(x)` exists.
Users write `ln(x)` for natural log, `log2(x)` for base-2, `log10(x)` for
base-10, and `log(base, x)` for arbitrary base. The two-argument `log`
takes the base as its first parameter.

Rounding operations (`floor`, `ceil`, `round`, `trunc`) are defined only on
floats. Integer ceiling division, floor division, and similar integer-domain
operations are standard-library concerns (e.g., a `div_ceil` method on
`Integer` if the stdlib provides it).

#### 4.8.3 Power operation

`pow` splits into two distinct traits based on operand kinds:

- `IntPow` (on `Integer`): integer base, integer exponent, integer result.
  Traps on overflow or on negative exponent (negative integer powers don't
  have integer results).
- `FloatPow` (on `Float`): float base, any-numeric exponent (integer
  promotes to float per §4.4.5), float result.

The typer picks the right trait based on the receiver's type. `2.pow(10)`
where `2` resolves to `i32` uses `IntPow`; `2.0.pow(0.5)` uses `FloatPow`.
The umbrella `Integer` includes `IntPow`; the umbrella `Float` includes
`FloatPow`.

A user calling `pow` with a negative integer exponent expecting a fractional
result must explicitly convert to float first:

```
let x = 2.pow(-1)              // ✗ compile error or trap: negative exponent on IntPow
let x = (2.0_f64).pow(-1)      // ✓ 0.5
let x = (2 as f64).pow(-1)     // ✓ 0.5
```

#### 4.8.4 Numeric constants

Constants live as associated values on the concrete numeric types, accessed
via path syntax:

```
f64::PI
f64::E
f64::TAU
f64::LN_2
f64::LN_10
f64::INFINITY
f64::NEG_INFINITY
f64::NAN
f32::PI
// ...
i32::MIN
i32::MAX
u8::MAX
i64::MIN
i64::MAX
// ...
```

Constants are associated with the concrete type rather than with traits
because their exact values depend on the type's representation (e.g.,
`f32::PI` and `f64::PI` differ in precision). Constants are `const`
declarations per §2.4.1.1, so they have no runtime storage and are inlined
at use sites.

### 4.9 The Numeric Trait Hierarchy

This section provides the concrete shape of the trait hierarchy referenced
throughout §3 and the preceding parts of §4. It instantiates the fine-
grained-plus-umbrella pattern from §3.6 for the numeric domain.

#### 4.9.1 Fine-grained operator traits

Each operator from §4.4 has its own trait, with the method name matching
the conventional operator name:

```
trait Add:    fn add(a: Self, b: Self) -> Self
trait Sub:    fn sub(a: Self, b: Self) -> Self
trait Mul:    fn mul(a: Self, b: Self) -> Self
trait Div:    fn div(a: Self, b: Self) -> Float    -- mathematical division
trait IntDiv: fn intdiv(a: Self, b: Self) -> Self  -- truncating
trait Rem:    fn rem(a: Self, b: Self) -> Self
trait Neg:    fn neg(value: Self) -> Self

trait BitAnd: fn bitand(a: Self, b: Self) -> Self
trait BitOr:  fn bitor(a: Self, b: Self) -> Self
trait BitXor: fn bitxor(a: Self, b: Self) -> Self
trait BitNot: fn bitnot(value: Self) -> Self
trait Shl:    fn shl(value: Self, n: u32) -> Self
trait Shr:    fn shr(value: Self, n: u32) -> Self

trait WrappingAdd:    fn wrapping_add(a: Self, b: Self) -> Self
trait WrappingSub:    fn wrapping_sub(a: Self, b: Self) -> Self
trait WrappingMul:    fn wrapping_mul(a: Self, b: Self) -> Self
trait WrappingIntDiv: fn wrapping_intdiv(a: Self, b: Self) -> Self
trait WrappingRem:    fn wrapping_rem(a: Self, b: Self) -> Self
trait WrappingNeg:    fn wrapping_neg(value: Self) -> Self

trait SaturatingAdd:  fn saturating_add(a: Self, b: Self) -> Self
trait SaturatingSub:  fn saturating_sub(a: Self, b: Self) -> Self
trait SaturatingMul:  fn saturating_mul(a: Self, b: Self) -> Self
trait SaturatingIntDiv: fn saturating_intdiv(a: Self, b: Self) -> Self
trait SaturatingRem:  fn saturating_rem(a: Self, b: Self) -> Self
trait SaturatingNeg:  fn saturating_neg(value: Self) -> Self

trait CheckedAdd:     fn checked_add(a: Self, b: Self) -> Option[Self]
trait CheckedSub:     fn checked_sub(a: Self, b: Self) -> Option[Self]
trait CheckedMul:     fn checked_mul(a: Self, b: Self) -> Option[Self]
trait CheckedDiv:     fn checked_div(a: Self, b: Self) -> Option[Self]
trait CheckedIntDiv:  fn checked_intdiv(a: Self, b: Self) -> Option[Self]
trait CheckedRem:     fn checked_rem(a: Self, b: Self) -> Option[Self]
trait CheckedNeg:     fn checked_neg(value: Self) -> Option[Self]

trait WrappingAs[T]:   fn wrapping_as(value: Self) -> T
trait SaturatingAs[T]: fn saturating_as(value: Self) -> T
trait CheckedAs[T]:    fn checked_as(value: Self) -> Option[T]

trait Zero: fn zero() -> Self
trait One:  fn one() -> Self

trait Abs:  fn abs(value: Self) -> Self
trait Min:  fn min(a: Self, b: Self) -> Self
trait Max:  fn max(a: Self, b: Self) -> Self

trait Sqrt: fn sqrt(value: Self) -> Self
trait Sin:  fn sin(value: Self) -> Self
trait Cos:  fn cos(value: Self) -> Self
// ... and so on for the float-only operations from §4.8.2

trait IntPow:   fn pow(base: Self, exp: Self) -> Self
trait FloatPow: fn pow(base: Self, exp: Self) -> Self

trait Ord: requires Lt, Le, Gt, Ge
trait Lt: fn lt(a: Self, b: Self) -> bool
trait Le: requires Lt, Eq
          fn le(a: Self, b: Self) -> bool:
            lt(a, b) or eq(a, b)
trait Gt: requires Lt, Eq
          fn gt(a: Self, b: Self) -> bool:
            not (lt(a, b) or eq(a, b))
trait Ge: requires Lt
          fn ge(a: Self, b: Self) -> bool:
            not lt(a, b)

trait Eq: fn eq(a: Self, b: Self) -> bool
```

This is the canonical fine-grained set. Stdlib may add additional fine-
grained traits for specialized operations; the principle (one trait per
capability) is what's normative, not the exact list above.

`Ord` and `Eq` are standalone — not part of any numeric umbrella per §3.6.1.
Non-numeric types (strings, enums, records) may also be ordered or compared,
so these traits live outside the numeric hierarchy.

`Ord` is an umbrella per §3.3.5: it requires the four ordering traits and
declares no methods of its own. A type satisfies `Ord` automatically when it
satisfies `Lt`, `Le`, `Gt`, `Ge`. In practice, implementers fulfill `Lt` and
`Eq` only — the default bodies on `Le`, `Gt`, `Ge` derive their behavior from
`Lt::lt` and `Eq::eq` per §3.1.3. Auto-derivation via `@derive(Ord)` per
§3.8 generates the full set of fulfill blocks structurally; manual
implementation requires only `fulfill Lt for X` and `fulfill Eq for X`.

The `is not` operator does not have its own trait method. `a is not b`
desugars at parse time to `not (a is b)` and dispatches through `Eq::eq` per
the operator semantics in §4.4.4. This preserves the one-method-per-trait
pattern: `Eq` declares one method (`eq`); the two operators `is` and `is not`
both flow through it.

#### 4.9.2 Umbrella traits

Umbrella traits combine fine-grained traits via `requires` clauses (§3.1.4),
introducing no new methods of their own. They are pure-requirement traits
per §3.3.5: automatically satisfied when all required traits are satisfied.

```
@default(i32)
trait Numeric:
  requires Add, Sub, Mul, Zero, One,
           WrappingAdd, WrappingSub, WrappingMul,
           SaturatingAdd, SaturatingSub, SaturatingMul,
           CheckedAdd, CheckedSub, CheckedMul,
           Abs, Min, Max

@default(i32)
trait Integer:
  requires Numeric, Rem, IntDiv, BitAnd, BitOr, BitXor, BitNot, Shl, Shr,
           WrappingRem, WrappingIntDiv,
           SaturatingRem, SaturatingIntDiv,
           CheckedIntDiv, CheckedRem,
           IntPow

@default(f64)
trait Float:
  requires Numeric, Neg, Div,
           CheckedAdd, CheckedSub, CheckedMul, CheckedDiv, CheckedNeg,
           Sqrt, Sin, Cos, Tan, Asin, Acos, Atan, Atan2,
           Ln, Log2, Log10, Exp, Exp2,
           Floor, Ceil, Round, Trunc,
           FloatPow

@default(i32)
trait Signed:
  requires Integer, Neg, WrappingNeg, SaturatingNeg, CheckedNeg

@default(u32)
trait Unsigned:
  requires Integer
  // Unsigned does NOT require Neg; types satisfying Unsigned do not
  // implement Neg, so unary `-` on them is a type error per §4.4.1
```

`Neg` is deliberately not part of `Numeric`. Unsigned integer types cannot
implement `Neg` (§4.4.1: unary `-` on unsigned is a type error), so placing
`Neg` in `Numeric` would prevent unsigned types from satisfying the
`Numeric` umbrella. The clean resolution: `Numeric` collects only the
operations meaningful for both signed and unsigned numbers; `Neg` (and its
wrapping/saturating/checked variants) appear on `Signed` and `Float`
separately. The signed/unsigned distinction is then exactly the presence
or absence of `Neg` in the type's effective method set: types satisfying
`Signed` implement `Neg`; types satisfying `Unsigned` do not; floats
implement `Neg` via the `Float` umbrella.

`Div` is on `Float` only (not on `Integer` or `Numeric`), reflecting Topic
5's rule that `/` always produces `Float`. Integer operands to `/` are
implicitly widened to float per §4.4.1.1 before `Div::div` is dispatched.

#### 4.9.3 Default mappings

Defaults declared on the umbrella traits per §3.1.5 are confirmed against
the final type set:

| Trait | Default Type | Rationale |
|---|---|---|
| `Numeric` | `i32` | Workhorse general-purpose integer |
| `Integer` | `i32` | Same |
| `Float` | `f64` | Higher precision preferred when unconstrained |
| `Signed` | `i32` | Workhorse signed integer |
| `Unsigned` | `u32` | Symmetric counterpart to `i32` |

The `i32` and `f64` defaults match modern language convention (Rust, Swift,
Kotlin, C#) and reflect the types where the cost/precision tradeoffs are
most balanced for general code.

#### 4.9.4 Auto-implementations for built-in numeric types

The fourteen built-in numeric types auto-implement the appropriate
fine-grained traits per §3.3 (auto-impls of built-in numeric traits for
built-in numeric types). Umbrella satisfaction follows transitively per
§3.3.5.

Specifically:

- **All integer types** auto-implement: `Add`, `Sub`, `Mul`, `Rem`,
  `IntDiv`, `BitAnd`, `BitOr`, `BitXor`, `BitNot`, `Shl`, `Shr`; the
  wrapping variants `WrappingAdd`, `WrappingSub`, `WrappingMul`,
  `WrappingIntDiv`, `WrappingRem`; the saturating variants
  `SaturatingAdd`, `SaturatingSub`, `SaturatingMul`, `SaturatingIntDiv`,
  `SaturatingRem`; the checked variants `CheckedAdd`, `CheckedSub`,
  `CheckedMul`, `CheckedIntDiv`, `CheckedRem` (note: not `CheckedDiv`,
  which is float-only since `/` widens integers to float per §4.4.1.1);
  the cast traits `WrappingAs`, `SaturatingAs`, `CheckedAs`; `Zero`,
  `One`, `Abs`, `Min`, `Max`, `Ord`, `Eq`, `IntPow`; and (for signed
  integer types) `Neg`, `WrappingNeg`, `SaturatingNeg`, `CheckedNeg`.
  They satisfy `Integer`, `Numeric`, and `Signed` or `Unsigned`
  accordingly.
- **Float types** auto-implement: `Add`, `Sub`, `Mul`, `Div`, `Rem`,
  `Neg`; the checked variants `CheckedAdd`, `CheckedSub`, `CheckedMul`,
  `CheckedDiv`, `CheckedNeg` (returning `None` on NaN or Infinity
  results per §4.6.6); the cast trait `WrappingAs[T]` for integer
  destination types `T` (per §4.7.3 — float-to-integer with
  implementation-defined modular truncation) and for wider-float
  destinations (trivially equivalent to `as` per §4.7.2 since the
  conversion is lossless); the cast traits `SaturatingAs[T]` and
  `CheckedAs[T]` for integer destinations (clamping NaN to 0, etc.,
  per §4.7.3), narrower-float destinations (saturation clamps to the
  destination's range bounds; checked returns `None` on overflow), and
  wider-float destinations (trivially equivalent to `as` per §4.7.2).
  `WrappingAs[T]` is *not* implemented for narrower-float destinations
  because modular wrap has no sensible meaning when the destination has
  reduced range and precision. Plus: float-only operations (`Sqrt`,
  trig, log, exp, rounding); inspection methods; `Zero`, `One`, `Abs`,
  `Min`, `Max`, `Ord`, `Eq`, `FloatPow`. Floats do not implement
  `WrappingAdd` / `SaturatingAdd` etc. — IEEE 754's infinity-and-NaN
  semantics already define overflow behavior, and modular or clamping
  interpretations would conflict (§4.6.6). They satisfy `Float`,
  `Numeric`, and `Signed` (floats are signed by convention — they
  support `Neg`).

User-defined numeric-like types (`Decimal` from stdlib, custom fixed-point
types, etc.) implement whichever fine-grained traits are appropriate;
umbrella satisfaction follows.

---

## 5. Type Intersection and `dyn`

The `&` operator expresses type intersection — "satisfies all of these
simultaneously" — and appears in three distinct contexts with related but
position-dependent semantics. The unifying intuition is uniform; the
concrete meaning varies by what the operands are and where the expression
sits.

The three contexts:

| Context | Operands | Example |
|---|---|---|
| Generic bound | Traits | `fn pick[T: A & B](...)` |
| Value-position trait object | Traits, behind `dyn` | `let x: dyn (A & B) = ...` |
| Record intersection at type definition | Records | `type X = A & B` |

### 5.1 Trait Conjunction in Generic Bounds

In a generic parameter list or where-clause, `T: A & B` constrains `T` to
be a type for which both `fulfill A for T` and `fulfill B for T` exist:

```
fn pick[T: Drivable & Insurable](item: T) -> T:
  ...

fn process[T](item: T) where T: Drivable & Insurable:
  ...
```

The `&` here is *constraint conjunction*, not a type expression. The
compiler resolves it statically at every use site; instantiations are
monomorphized per §2.3 with no runtime dispatch cost. A type either
satisfies all conjoined constraints or it doesn't; the constraint set is
checked at the call site for each concrete instantiation.

Conjunction is commutative and associative: `A & B`, `B & A`, and
`(A & B) & C` are equivalent constraint sets.

### 5.2 Trait Objects at Value Position (`dyn`)

A trait may appear at value position — as the type of a variable, parameter,
field, or return value — only when wrapped in `dyn`. The resulting *trait
object* dispatches method calls dynamically through a vtable.

#### 5.2.1 Single-trait and multi-trait forms

Single-trait `dyn`:

```
let x: dyn Drivable = some_value
fn render(item: dyn Renderable) -> string: ...
```

Multi-trait `dyn` (intersection at value position):

```
let x: dyn (Drivable & Insurable) = some_value
fn process(item: dyn (Drivable & Insurable)) -> dyn Renderable: ...
```

When `dyn` precedes an intersection of traits, the intersection MUST be
parenthesized. Without parens, `dyn Drivable & Insurable` parses as
`(dyn Drivable) & Insurable` — `dyn Drivable` becomes a trait object,
which is then intersected with the bare trait `Insurable`, which is
ill-formed (trait objects are not in the `{trait & trait}` intersection
domain per §5.5). The parens force the intended grouping: `dyn` applied
to the trait-intersection expression as a whole.

#### 5.2.2 `dyn` is mandatory for trait-object value positions

`dyn` is *required* at every trait-object value position. The bare form
`let x: Drivable` (no `dyn`) is a parse error when `Drivable` is a trait
rather than a concrete type. Similarly, `let x: Drivable & Insurable`
(no `dyn`) is a parse error when both operands are traits.

The requirement makes dynamic-dispatch costs visible at the declaration
site rather than hidden behind syntax that looks like a plain type
annotation. Users who want static dispatch use generics with trait bounds
per §5.1; users who want dynamic dispatch use `dyn` per §5.2 and pay the
indirection cost knowingly.

#### 5.2.3 Dispatch cost

Trait objects dispatch through a vtable. The runtime cost is an indirect
call per method invocation, plus the storage cost of the vtable pointer
adjacent to the value's data. The costs are bounded and predictable;
they are simply not zero, which is the property `dyn` makes visible.

#### 5.2.4 Object safety

Not every trait can be used in a `dyn` position. Traits with methods whose
signatures depend on `Self` in non-receiver positions, traits with
associated types not bound at the use site, or traits with generic methods
cannot be made into trait objects under the standard vtable mechanism.
Object-safety rules are specified in detail in § — Object Safety
(deferred). A trait that is not object-safe used in a `dyn` position
produces a compile error at the use site identifying the offending trait
and the reason.

#### 5.2.5 Coercion to `dyn`

A value of a concrete type `T` that fulfills traits `A` and `B` can be
assigned to a `dyn (A & B)` binding via an explicit coercion. The exact
syntax is specified in § — Coercion (deferred); the principle is that
moving from a static type to a trait object is a deliberate operation at
the assignment or argument-passing site, not an implicit conversion.

### 5.3 Record Intersection at Type Definition

A `type` declaration whose right-hand side is a record-record intersection
produces a new nominal record type combining the fields of both operands:

```
type Car:
  brand: string
  speed: f64
  wheels: i32

type Insured:
  policy_number: string
  premium: f64

type InsuredCar = Car & Insured

// Equivalent declaration:
type InsuredCar:
  brand: string
  speed: f64
  wheels: i32
  policy_number: string
  premium: f64
```

The resulting `InsuredCar` is *nominally distinct* from both `Car` and
`Insured`. Values of `Car` are not implicitly assignable to `InsuredCar`
(a `Car` lacks the insurance fields); values of `InsuredCar` are not
implicitly assignable to `Car` (no implicit projection of fields).
Conversion requires explicit construction or a `From` impl per §7.

The intersection is a *definitional combinator* producing a new named type,
not a subtyping relationship. The language has no nominal subtyping; record
intersection composes structure into a new identity, full stop.

#### 5.3.1 Field merging rules

When both operand records declare a field with the same name:

- **Identical types and identical visibility** — the merged record has a
  single field of that name, type, and visibility. No duplication.
- **Different types** — the intersection is a compile error identifying the
  conflicting field name and the two incompatible types. The user resolves
  by writing the record explicitly with the chosen field type, or by
  adjusting the source records.
- **Same type, different visibility** — the intersection is a compile error
  identifying the conflicting field name and the two incompatible visibility
  specifiers. Visibility is part of a field's contract per §10; the two
  operand records disagree about how the field should be exposed, and the
  merged record cannot resolve the disagreement without arbitrarily picking
  one. The user resolves by writing the record explicitly with the chosen
  visibility or by aligning the source records.

#### 5.3.2 Trait inheritance via `@derive`

Trait inheritance from the operand records is opt-in via `@derive` per
§3.8. Each trait to be inherited is explicitly listed in the annotation,
and the compiler generates the `fulfill` block by delegating to the
operand types' implementations:

```
@derive(Display, Hash)
type InsuredCar = Car & Insured
```

When both operand records have `fulfill` blocks for the same trait that
would equally apply, derivation is ambiguous; the compiler reports an error
and the user must write the implementation manually.

The mechanism mirrors `@derive` for newtypes (§6.3.3): explicit
opt-in trait inheritance, no automatic carry-over of traits the user didn't
ask for.

### 5.4 Interaction with `alias type`

The `alias type` mechanism (§4.2; contrasted with newtypes in §6.3)
produces transparent
substitution — the alias name and its right-hand side refer to the same
thing, no new identity. Interaction with `&` depends on what the right-hand
side evaluates to:

- **`alias type X = A & B` where A, B are traits** — valid. The alias names
  a *constraint* usable in bound positions. `fn process[T: X](item: T)` is
  equivalent to `fn process[T: A & B](item: T)`. Useful for naming common
  bounds for reuse.
- **`alias type X = dyn (A & B)` where A, B are traits** — valid. The alias
  names a *dynamic-dispatch trait object type*. `let value: X = ...` is
  equivalent to `let value: dyn (A & B) = ...`.
- **`alias type X = A & B` where A, B are records** — rejected at compile
  time. Record intersection creates a new nominal type with combined
  fields; that creation requires `type`, not `alias type`. Without new
  identity, the intersection has no meaning in the nominal type system.
  The compile error directs the user to write `type X = A & B` instead.

The asymmetry between trait intersection (aliasable) and record
intersection (not aliasable) reflects a deeper asymmetry: trait
intersection produces a constraint (or a `dyn` type with explicit
identity); record intersection produces fields-combined-into-a-new-type
that has meaning only as a nominal type with identity. Aliases work where
the right-hand side already has identity; they don't work where the
right-hand side requires a type declaration to acquire identity.

### 5.5 Cross-Kind Intersection

Intersection is well-defined only within `{trait & trait}` and `{record &
record}`. Cross-kind combinations and same-kind combinations outside those
two sets are rejected at compile time:

- `Trait & Record` — rejected. A trait expresses a behavior contract; a
  record expresses structure. Their intersection has no coherent meaning.
- `Record & Enum` — rejected. Records and enums are distinct compound
  kinds; combining them produces no type the language can represent.
- `Trait & Enum` — rejected. Same reasoning.
- `Enum & Enum` — rejected. Enums are tagged unions; intersection of two
  tagged unions has no meaningful semantics (the union of their variants
  would be `|`-shaped, not `&`-shaped, and is not provided by the language).
- Intersections involving tuples, function types, or primitive types —
  rejected. These kinds are not subject to intersection.

The compiler reports the cross-kind intersection error at the `&`
expression with the operand kinds named.

### 5.6 Variance and Intersection

The language has no variance markers and no subtyping between generic
instantiations (§2.3). `Container[Cat]` and `Container[Animal]` are
unrelated types regardless of any relationship between `Cat` and `Animal`.

Intersection of two distinct generic instantiations (e.g.,
`Container[Cat] & Container[Animal]`) follows the rules for the resulting
kinds. As record intersection, the operands' fields would typically
conflict (different generic instantiations differ in their field types per
§2.3.1's strict-structural keying), so most such expressions are compile
errors via §5.3.1's same-name-different-type rule. As trait conjunction,
the conjunction is well-formed but produces a constraint that may have no
satisfying type — generic constraints don't fail at the constraint
declaration; they fail at the call site where no concrete type satisfies
both.

---

## 6. Records, Enums, and Newtypes

This section specifies the language's three user-defined nominal compound
types: records (product types), enums (sum types), and newtypes (wrapper
types). All three are nominal — identity is by name, not structure — and
all three participate uniformly in the trait system per §3.

### 6.1 Records

A record is a nominal product type with a fixed set of named fields. Records
carry data only; they have no methods of their own. Behavior associated with
a record's type is expressed via free functions and trait implementations
that the record satisfies, per §3.

#### 6.1.1 Declaration

A record is declared with the `type` keyword followed by the type name and a
body of field declarations (grammar §3.5):

```
type Person:
  first_name: string
  last_name: string
  age: i32

type Vec3:
  x: f64
  y: f64
  z: f64

type Point[T]:
  x: T
  y: T
```

Each field declares a name, a type, and optionally a default value. The
field type may be any type expression — primitive, record, enum, generic
parameter, trait object, or compound. A record may declare generic
parameters in the standard `[T, U, ...]` form; each generic parameter is
in scope within the field declarations.

A record body may include a `satisfies` clause listing the traits the type
promises to implement (§3.2):

```
type Person:
  satisfies Display, Hash, Eq
  first_name: string
  last_name: string
  age: i32
```

The `satisfies` clause may appear once per record, conventionally at the
top of the body. Per §3.2, every trait listed must have a matching `fulfill`
block reachable through the module graph; pure-requirement umbrella traits
per §3.3.5 are satisfied automatically when their requirements are.

Records do not declare methods. Functions operating on record instances are
free functions defined elsewhere (grammar §3.13) or trait-method
implementations in `fulfill` blocks (§3.3). The uniform function call
syntax (§3.4) makes these callable as `x.f()`, `x >> f`, or `f(x)`
indifferently.

#### 6.1.2 Field defaults

A field may declare a default value:

```
type Window:
  title: string
  width: i32 = 800
  height: i32 = 600
  resizable: bool = true
```

A default value is any expression valid at the record's declaration scope.
Per §2.4.1, defaults that are compile-time-known (the typical case) are
evaluated and inlined at construction sites where the field is omitted;
defaults involving runtime values are evaluated at each construction.

Defaults compose with construction (§6.1.3): a field with a default may be
omitted at the construction site, in which case the default applies.

#### 6.1.3 Construction

A record value is constructed by calling the type name with named arguments:

```
let alice = Person(
  first_name: "Alice",
  last_name: "Smith",
  age: 30,
)

let w = Window(title: "Main")  // width, height, resizable use their defaults
```

Field arguments are named, not positional. The order of named arguments
does not matter. Every field without a default must be supplied; supplying
the same field twice is a compile error; supplying an unknown field name is
a compile error.

Positional construction is not supported. Records are nominal product types
with named fields; positional construction would obscure which value goes
into which field, especially for records with many fields or fields of the
same type. The explicit-name requirement is verbose at small record sizes
but scales cleanly.

Generic records require concrete type arguments at construction. The
arguments may be inferred from the field types or supplied explicitly:

```
let p: Point[f64] = Point(x: 1.0, y: 2.0)         // T inferred from arguments
let q = Point::[i32](x: 1, y: 2)                  // T explicit via turbofish
```

#### 6.1.4 Field access

A field is accessed by dot notation: `record.field_name`. The dot operator
is the field-access operator, distinct from the method-call operator (which
also uses `.` but is followed by a function name and call syntax). The
compiler disambiguates by the syntax following the dot.

Field access is read-only. A record's fields cannot be reassigned after
construction; the binding's immutability (§1.3) applies transitively to the
fields. To produce a modified record, the user constructs a new record
value, typically via the record-update expression `with` (§6.1.5).

#### 6.1.5 Record update with `with`

The `with` expression produces a new record value derived from an existing
one with selected fields overridden or merged from other records:

**Single-line form (comma-separated):**

```
let updated = base with name: "new"
let updated = base with name: "new", age: 30
let updated = base with other
let updated = base with other1, other2
let updated = base with other1, other2, name: "new", age: 30
```

**Multi-line form (colon-introduced body):**

```
let updated = base with:
  name: "new"
  age: 30

let updated = base with other1, other2:
  name: "new"
  age: 30
```

These are the only two surface forms. Mixing single-line and multi-line in
one expression is a parse error.

The expression's components, evaluated left to right:

- The *base* (`base`) — a record value whose type defines the result type.
- Zero or more *merge sources* (other record values like `other1`,
  `other2`) — each must be of the same type as the base; fields are
  copied into the result.
- Zero or more *field overrides* (`name: "new"`) — each override sets one
  field of the result.

The result is a new record of the base's type. Merge sources and field
overrides are applied left-to-right; later assignments win on conflict.
For `base with other1, other2, name: "new"`:

1. Start with `base`'s field values.
2. Override with `other1`'s field values.
3. Override with `other2`'s field values.
4. Override `name` with `"new"`.

A field unset in any source/override keeps the base's value. The result is
always the same record type as the base.

##### Same-type constraint

All merge sources must have the *exact same type* as the base. Cross-type
merge is a compile error. The `with` expression does not create new types
at runtime; the language's type system is static.

```
let car_2: Car = car_1 with car_3        // ✓ both Car
let bad = car with insured_record         // ✗ Car and Insured are different types
```

For combining different types' fields into a new type, the user constructs
a record-intersection type per §5.3 and constructs values of it
explicitly.

##### Field-override constraints

Every override field name must exist in the base's type. Overriding a
non-existent field is a compile error. Override values must be type-
compatible with the field's declared type (subject to the same widening
and conversion rules as direct construction per §6.1.3).

#### 6.1.6 Field visibility

Each field carries an independent visibility specifier per §10:

```
type Account:
  public id: i64                  // readable anywhere the type is visible
  email: string                   // shared (default) — readable within package
  private password_hash: string   // readable only within this file
```

Field visibility is independent from the enclosing type's visibility and
from the constructor's visibility (§6.1.7). A field's visibility never
exceeds the enclosing type's visibility — declaring a `public` field on a
`private` type is a compile error, because no caller outside the type's
visibility scope could observe the field.

A field accessed from outside its visibility scope produces a compile
error. The error is at the access site, not at the record's declaration.

#### 6.1.7 Constructor visibility

The constructor's visibility is independently controllable from the type's
visibility per §10's `public(constructor_vis)` mechanism:

```
public type Email:                            // both public
  wraps string

public(private) type Email:                   // type public, constructor private
  wraps string                                // (smart-constructor pattern)

shared(private) type SecretConfig:            // type shared, constructor private
  api_key: string
  endpoint: string
```

When the constructor is private, the type's name is visible but the
construction syntax `TypeName(...)` is unreachable from outside the
constructor's scope. The pattern enables types whose values can only be
created through controlled paths — typically via a `From` impl or a
factory function (§7).

Constructor visibility never exceeds type visibility; an inner specifier
more permissive than the outer is a compile error.

#### 6.1.8 Trait auto-derivation

Per §3.8, the `@derive` annotation generates structural trait
implementations for a fixed set of traits:

```
@derive(Eq, Ord, Hash, Clone, Display, Debug)
type Person:
  first_name: string
  last_name: string
  age: i32
```

Derivation operates field-by-field per §3.8.2: each field's type must
itself satisfy the trait being derived. Derivation failure (a field whose
type doesn't satisfy the trait) is a compile error identifying the
offending field.

Some derivable traits have dependencies on others. Deriving `Ord` requires
`Eq` to also be available on the same type — either by being derived in
the same annotation or by being satisfied through a manual `fulfill`
block. This dependency reflects the implementation: `Ord`'s default
bodies for `Le`, `Gt`, `Ge` (per §4.9.1) call `Eq::eq`. Deriving `Ord`
without `Eq` is a compile error identifying the missing dependency.

#### 6.1.9 Records and trait dispatch

A record's behavior — equality, hashing, display, comparison, conversion,
domain-specific operations — is delivered through trait implementations,
not through methods declared on the record. The implementations live in
`fulfill` blocks per §3.3, and dispatch through uniform function call
syntax per §3.4. The record's body is restricted to data.

This separation is structural, not stylistic: a record body cannot contain
`fn` declarations. Functions that operate on a record live as free
functions or as `fulfill`-block methods, never inside the record's body.

### 6.2 Enums

An enum is a nominal sum type — a tagged union of variants. Each variant
has a name and an optional payload of types. A value of the enum is exactly
one of the declared variants at any time; pattern matching (§6.2.4) is the
canonical way to inspect which.

#### 6.2.1 Declaration

An enum is declared with the `enum` keyword (grammar §3.6):

```
enum Direction:
  North
  South
  East
  West

enum Shape:
  Circle(f64)                              // positional payload
  Rectangle(width: f64, height: f64)       // named payload
  Triangle(f64, f64, f64)                  // positional payload

enum Result[T, E]:
  Ok(T)
  Err(E)

enum Option[T]:
  Some(T)
  None
```

Each variant declares a name (PascalCase, like a type name) and zero or
more payload fields. Payload fields may be declared in two forms:

- **Positional payload** — the type alone, with no name:
  `Circle(f64)`, `Ok(T)`, `Triangle(f64, f64, f64)`.
- **Named payload** — name and type, parallel to record fields:
  `Rectangle(width: f64, height: f64)`.

A variant with no payload is a *unit variant* (`North`, `None`).

Within a single variant's payload declaration, the form is uniform: all
positional or all named. Mixing within one variant declaration is a
compile error:

```
enum Bad:
  Mixed(width: f64, f64)         // ✗ compile error — mixed declaration
```

Different variants of the same enum may use different forms independently,
as `Shape` above shows.

##### 6.2.1.1 Implications for construction and patterns

The declaration form determines which call/pattern forms are available
for each variant:

- A variant with **named payload** supports both positional and named
  forms at construction sites and pattern matches. The choice is per-site
  per §3.5.
- A variant with **positional payload** supports only positional form at
  construction sites and pattern matches. No names were declared; named
  form is not available.

```
enum Shape:
  Circle(f64)
  Rectangle(width: f64, height: f64)

// Circle (positional declaration):
let c1 = Shape::Circle(5.0)                            // ✓ positional
let c2 = Shape::Circle(radius: 5.0)                    // ✗ no name "radius" declared

// Rectangle (named declaration):
let r1 = Shape::Rectangle(width: 10.0, height: 20.0)   // ✓ named
let r2 = Shape::Rectangle(10.0, 20.0)                  // ✓ positional (always available)
let r3 = Shape::Rectangle(width: 10.0, 20.0)           // ✗ mixed within call

// Pattern matching mirrors construction:
match shape:
  Circle(r):                                            // ✓ positional binding
    use_circle(r)
  Rectangle(w, h):                                      // ✓ positional binding
    use_rect(w, h)
  Rectangle(width: w, height: h):                       // ✓ named binding
    use_rect(w, h)
```

The form chosen at the declaration site is part of the variant's API.
Adding names to a previously positional variant is a non-breaking change
(both forms become valid); removing names from a previously named variant
is a breaking change (named-form call sites stop compiling).

##### 6.2.1.2 Choosing a form

Positional declarations are appropriate when:

- The variant has a single payload field with self-evident meaning
  (`Some(T)`, `Ok(T)`, `Err(E)`).
- The variant is conceptually a tuple with positional identity.
- Conciseness matters and the type alone documents the payload.

Named declarations are appropriate when:

- The variant has multiple payload fields whose roles aren't
  self-evident from order alone.
- The variant has multiple fields of the same type and positional order
  would be error-prone.
- Documentation value of field names outweighs the verbosity.

The stdlib uses positional payloads for `Option::Some`, `Result::Ok`, and
`Result::Err` because each carries a single value whose role is captured
by the variant name itself.

Generic parameters on the enum are in scope within all variants' payload
declarations.

#### 6.2.2 Conformance

An enum may include a `satisfies` clause listing the traits the type
implements, parallel to records:

```
enum Color:
  satisfies Display, Eq, Hash
  Red
  Green
  Blue
  Custom(r: u8, g: u8, b: u8)
```

Per §3.2, `satisfies` requires matching `fulfill` blocks. The conformance
applies to the *enum as a whole*, not per-variant. A trait implementation
for an enum handles all variants — typically via a `match` expression on
the input — and produces a uniform result type:

```
fulfill Display for Color:
  fn display(value: Color) -> string:
    match value:
      Red: "red"
      Green: "green"
      Blue: "blue"
      Custom(r, g, b): "rgb({r}, {g}, {b})"
```

#### 6.2.3 Variant construction and resolution

A variant value is constructed by naming the variant and (for payload
variants) supplying its arguments:

```
let d = Direction::North
let c = Shape::Circle(5.0)                         // positional (Circle declared positionally)
let r1 = Shape::Rectangle(width: 10.0, height: 20.0)   // named (Rectangle has names)
let r2 = Shape::Rectangle(10.0, 20.0)              // positional (always available)
let res: Result[i32, string] = Result::Ok(42)
let n: Option[i32] = Option::None
```

By default, every variant reference is *path-qualified* with the enum name
via `::` (`Result::Ok`, `Direction::North`). The path qualification makes
the variant's enum unambiguous at every use site.

Unqualified variant names are not available by default. To bring variants
into scope unqualified, the user explicitly imports them via `use`:

```
use Result::(Ok, Err)
use Direction::*

let r = Ok(42)                                 // ✓ Result::Ok imported
let e = Err("bad")                             // ✓ Result::Err imported
let d = North                                  // ✓ all Direction variants imported
```

Selection lists in `use` paths use parentheses. The language uses `()` for
grouping uniformly — function arguments, generic arguments, tuple
construction, expression grouping, trait intersection (`dyn (A & B)`) —
and path selection follows the same convention. The context disambiguates
the two uses of `()`: after `::` it is a selection list; after a value
expression it is a call.

Two enums imported into the same scope whose variants have colliding
names produce an *import-time* conflict, not a call-site ambiguity:

```
use Direction::*       // brings North, South, East, West
use Heading::*         // ERROR: Heading::North conflicts with Direction::North
```

The user resolves by importing selectively (`use Heading::(East, West)` if
only some variants don't conflict) or by importing one enum's variants
and keeping the other path-qualified.

Conflicts are surfaced where they originate (the `use` statements), not
where the offending name would be used. This keeps call sites unambiguous
and makes import-induced confusion visible at the import declarations.

#### 6.2.4 Pattern matching

The `match` expression is the canonical way to consume an enum value
(grammar §3.13's `MatchExpr`). Each arm specifies a pattern and an
expression:

```
let area = match shape:
  Circle(radius):
    f64::PI * radius * radius
  Rectangle(width, height):
    width * height
  Triangle(a, b, c):
    let s = (a + b + c) / 2.0
    (s * (s - a) * (s - b) * (s - c)).sqrt()
```

Variant patterns parallel variant construction (§6.2.1.1): they may use
*positional* form binding payload fields by declaration order, or
*named* form binding by field name (when the variant declared field
names). Mixing the two within one pattern is a compile error.

```
// Positional form — bindings in declaration order:
Rectangle(width, height): ...

// Named form — bindings by field name (requires named declaration):
Rectangle(width: w, height: h): ...

// Named form with bound name matching field name:
Rectangle(width: width, height: height): ...    // verbose; the positional form is equivalent

// Mixed — error:
Rectangle(width, height: h): ...                // ✗ compile error
```

Named-form patterns are available only when the variant was declared with
named payload fields (§6.2.1). Positionally-declared variants accept
positional patterns only — there are no field names to match. For
example, `Some(T)` (positionally declared) accepts `Some(x)` but not
`Some(value: x)`.

In the named form, the syntax `field_name: bound_name` binds the
variant's field value to a new local name. The positional form
`Rectangle(width, height)` (binding `width` and `height` as the local
names) is the conventional terse choice when the field names happen to
match the desired local names.

Patterns may be nested for compound values:

```
match (a, b):
  (Ok(x), Ok(y)): x + y
  (Ok(_), Err(e)): panic("right error: {e}")
  (Err(e), _): panic("left error: {e}")
```

Wildcard patterns (`_`) match without binding. Catch-all patterns (a bare
identifier with no constructor) match any value and bind it.

#### 6.2.5 Exhaustiveness checking

A `match` expression must be exhaustive: every possible variant of the
matched enum (and every combination, for compound matches) must be covered
by some arm. The compiler verifies exhaustiveness at compile time. A
non-exhaustive match is a compile error identifying which variants are
unreached.

Exhaustiveness is structural: adding a new variant to an enum makes every
non-exhaustive match throughout the codebase fail to compile, surfacing the
sites that need updating. This is one of the language's principal safety
properties: enums and matches are an early-warning system for evolution.

A catch-all arm (`_:` or a bare identifier) covers all remaining variants
and makes the match trivially exhaustive. Users may opt into this when
adding a new variant should be silently absorbed (rare and usually a
mistake).

#### 6.2.6 Enum visibility

Visibility per §10 applies to the enum as a whole, not per-variant:

```
public enum Direction:
  North
  South
  East
  West
```

The enum's variants share the enum's visibility. There is no per-variant
visibility specifier. If a user wants some variants visible and others
hidden, they split the enum into multiple enums (each with its own
visibility) and provide conversion functions between them.

#### 6.2.7 Trait auto-derivation

Per §3.8, enums support `@derive` for the same fixed set of traits as
records:

```
@derive(Eq, Ord, Hash, Clone, Display, Debug)
enum Color:
  Red
  Green
  Blue
  Custom(r: u8, g: u8, b: u8)
```

Derivation operates variant-by-variant. For `Eq`, the implementation
compares variant tags and, for matching tags, compares payload fields
pairwise. For `Ord`, variants are ordered by declaration order, with ties
broken by payload comparison. For `Hash`, the variant tag and payload
fields are combined. For `Clone`, each variant's payload is structurally
copied. For `Display` and `Debug`, the generated output is a
compiler-defined structural format.

Derivation requires every variant payload's field type to itself satisfy
the trait being derived. Failure is a compile error identifying the
offending payload field.

### 6.3 Newtypes

A newtype is a wrapper type that creates a new nominal identity over an
existing type. Newtypes are the standard way to add domain meaning to a
primitive or stdlib type, satisfy the orphan rule for foreign-trait +
foreign-type combinations (§3.7.4), or enforce invariants at construction.

#### 6.3.1 Declaration

A newtype is declared with the `type` keyword and a body containing a
`wraps` clause naming the underlying type:

```
type Email:
  wraps string

type UserId:
  wraps i64

type Distance:
  wraps f64

type MyVec[T]:
  wraps Vec[T]
```

The signature line matches ordinary record and enum declarations
(`type Name[generics]:`) for uniformity. The `wraps` clause inside the
body identifies the declaration as a newtype and names its underlying
type. The body may include other clauses — `satisfies` clauses or
metadata declarations — but it may not contain field declarations. A
`wraps` body and a field-declaration body are mutually exclusive: a
newtype wraps one underlying value; a record declares its own fields.
The compiler rejects bodies that mix `wraps` with field declarations.

The contrast with `alias type` from §4.2:

```
alias type byte = u8         // transparent alias; byte and u8 are the same type
type UserId:                 // newtype; UserId is distinct from i64
  wraps i64
```

`alias type` produces transparent substitution — no new identity. A
`type` declaration with a `wraps` clause produces a *new* nominal
identity. The two forms are syntactically distinct and serve opposite
purposes.

A newtype body may include `satisfies` clauses for explicitly implemented
traits per §3.2:

```
type Email:
  wraps string
  satisfies TryFrom[string]

fulfill TryFrom[string] for Email:
  fn try_from(s: string) -> Result[Email, ValidationError]:
    if is_valid_email(s):
      Ok(Email(s))
    else:
      Err(ValidationError::Invalid)
```

The same `satisfies`/`fulfill` discipline from §3.2 applies. The
`@derive` annotation per §3.8 is the shorthand for the common case where
trait conformance is structural over the underlying type.

#### 6.3.2 Construction and extraction

A newtype is constructed by calling its type name with the underlying
value as a single positional argument:

```
let email = Email("alice@example.com")
let id = UserId(42)
let distance = Distance(1.5)
```

Construction is always positional with one argument — the underlying
value. No named-argument form, no multi-argument form. The newtype wraps
exactly one value; the constructor reflects that shape.

Extraction of the underlying value uses the `as` operator:

```
let s: string = email as string      // unwraps Email to string
let n: i64 = id as i64               // unwraps UserId to i64
let d: f64 = distance as f64         // unwraps Distance to f64
```

##### Note on `as` overloading

The `as` operator has two distinct uses in the language, dispatched by
operand kind:

- **Numeric cast** (§4.7) — converts between numeric primitive types,
  potentially with trap-on-range-violation. Both operand and target are
  numeric primitives.
- **Newtype extraction** (here) — unwraps a newtype to its underlying
  type. The operand is a newtype; the target is its `wraps` type.

The two uses are unambiguous because the operand types determine the
applicable mode: `5_i32 as f64` is a numeric cast (both are numeric
primitives); `email as string` is a newtype extraction (`Email` is a
newtype, `string` is its wrapped type). Mixing — e.g., extracting and
re-casting in one operation — requires two `as` applications:

```
let n_str: string = some_userid as i64 as string  // ERROR: i64 -> string isn't a numeric cast
let n: i64 = some_userid as i64
let s = n.to_string()                              // use stdlib conversion
```

The asymmetric construction/extraction interfaces are deliberate.
Construction is a *creation* of new identity (typed call). Extraction is
a *discarding* of identity (explicit cast). The two operations are kept
syntactically distinct so that a reader sees clearly when domain identity
is being introduced versus removed.

#### 6.3.3 Trait inheritance via `@derive`

By default, a newtype inherits *no* traits from its underlying type. The
nominal-identity-creating purpose of a newtype is undermined if it
automatically inherits behavior — users typically introduce a newtype
precisely to *not* expose the underlying type's operations.

Trait inheritance is opt-in via `@derive`:

```
@derive(Eq, Hash, Display)
type Email:
  wraps string

@derive(Add, Sub, Mul)
type Distance:
  wraps f64

@derive(Eq, Ord, Clone)
type UserId:
  wraps i64
```

For each derived trait, the compiler generates a `fulfill` block that
delegates to the underlying type's implementation. Operations on the
newtype dispatch through this delegation to the underlying behavior. For
example, `@derive(Add)` on `Distance` allows `Distance(1.0) +
Distance(2.0)` to dispatch to `f64`'s `Add::add`, producing
`Distance(3.0)`.

Operators across different newtype identities require explicit
implementation: `Distance + i32` is a compile error unless the user
writes a `fulfill Add[i32] for Distance` block manually (with a matching
`satisfies Add[i32]` in `Distance`'s body). The orphan rule (§3.7)
permits this in the newtype's defining module.

The `@derive` annotation implicitly declares `satisfies` for the listed
traits — the user does not write `satisfies Eq, Hash, Display` separately
when using `@derive(Eq, Hash, Display)`. Manual `fulfill` blocks still
require their corresponding `satisfies` clauses in the body per §3.2.

Derivation fails (compile error) if the underlying type does not satisfy
the trait being derived — `@derive(Display)` on a newtype wrapping a
non-`Display` type is rejected at the annotation site.

Deriving `Ord` requires the underlying type to satisfy `Eq`, parallel to
records (§6.1.8).

#### 6.3.4 Constructor visibility

Like records (§6.1.7), a newtype's constructor visibility is
independently controllable from its type visibility:

```
public(private) type Email:
  wraps string
  satisfies TryFrom[string]
```

This is the smart-constructor pattern: the type name `Email` is visible
publicly (so other modules can use `Email` in signatures), but
construction `Email(...)` is restricted (so only the defining module can
produce `Email` values, typically via a validating `From[string]` or
`TryFrom[string]` impl that enforces invariants).

The pattern is the language's mechanism for enforcing invariants at
construction time: any path that produces an `Email` value passes through
the constructor's visibility scope, which can enforce arbitrary checks.

#### 6.3.5 Newtypes and the orphan rule

A common use of newtypes is to work around the orphan rule (§3.7.1).
Implementing a foreign trait for a foreign type is forbidden, but
implementing a foreign trait for a *local newtype wrapping* the foreign
type is permitted:

```
// In user module:
type MyVec[T]:
  wraps Vec[T]
  satisfies SomeForeignTrait

fulfill SomeForeignTrait for MyVec[T]:
  ...
```

`MyVec` is local to the user's module; the orphan rule's "trait or type
defined locally" check is satisfied. The wrapping is structurally trivial
but semantically meaningful: it creates a distinct identity over which
the user has implementation authority.

---

## 7. Conversion System

User-defined conversions between types use a pair of trait pairs:
`From`/`Into` for infallible conversions and `TryFrom`/`TryInto` for
fallible conversions. The conversion system is layered on top of the trait
system (§3) and complements the built-in numeric implicit-widening rules
(§4.5) and the `as` operator (§4.7).

### 7.1 The Four Traits

```
trait From[T]:
  fn from(value: T) -> Self

trait Into[T]:
  fn into(value: Self) -> T

trait TryFrom[T]:
  type Error
  fn try_from(value: T) -> Result[Self, Error]

trait TryInto[T]:
  type Error
  fn try_into(value: Self) -> Result[T, Error]
```

`From` and `Into` describe the same conversion from two perspectives —
"construct `Self` from a `T`" vs "convert `Self` into a `T`." Likewise
`TryFrom` and `TryInto` describe the same fallible conversion.

The fallibility split is semantic. `From`/`Into` is for conversions that
cannot fail — widening, identity, lossless transformations.
`TryFrom`/`TryInto` is for conversions that can fail — narrowing, parsing,
range checks, validation. The trait the user implements signals fallibility
to every caller. Each fallible conversion declares its own `Error`
associated type, so different conversions can produce different error
kinds (range error, parse error, validation error, etc.).

### 7.2 Users Implement `From` and `TryFrom`; the Reverses Auto-Derive

Users write `fulfill From[T] for U` (or `fulfill TryFrom[T] for U`); the
language automatically provides the reverse direction:

- Whenever `From[T] for U` exists, `Into[U] for T` is auto-provided.
- Whenever `TryFrom[T] for U` exists, `TryInto[U] for T` is auto-provided
  with the same `Error` associated type.

The auto-derivation is language-built-in and not user-overridable. This
forecloses the coherence problem of disagreeing manual `From`/`Into` pairs.

`Into` and `TryInto` are *sealed* traits: declared by the language for use
in trait bounds (`T: Into[U]`) and method dispatch (`x.into::[U]()`), but
not implementable by users. All `Into[U] for T` impls come from
auto-derivation of a corresponding `From[T] for U` impl (plus the
identity case per §7.3); all `TryInto[U] for T` impls come from
auto-derivation of `TryFrom[T] for U`. Users do not write `fulfill
Into[U] for T` or `fulfill TryInto[U] for T` directly — the compiler
synthesizes the impl from the corresponding `From` or `TryFrom`. To
expose a conversion from `T` to `U` to users, write the `From[T] for U`
impl on the destination type; the `Into` direction follows automatically.

The `From`/`TryFrom` impls are the user's written contract; the
`Into`/`TryInto` impls are the language's mechanical counterparts.
Neither auto-derived impl requires a `satisfies` declaration on its
source type (per §3.7.3 — language-privileged implementations).

### 7.3 Identity Conversion

The language auto-implements `From[T] for T` for every type, providing the
identity conversion. The corresponding `Into[T] for T` is also auto-derived.

This makes generic code cleaner: a function parameter `T: Into[U]`
accepts both `U` (via identity) and any type explicitly convertible to
`U`. The user can pass the destination type directly without an
intermediate conversion call.

Identity conversion is not subject to the orphan rule (§3.7.3); it is one
of the language-privileged implementations.

### 7.4 The Orphan Rule Applies to User Conversions

User-written `fulfill From[T] for U` and `fulfill TryFrom[T] for U` are
subject to the standard orphan rule per §3.7.1, including the
generic-parameter-coverage rule from §3.7.2: at least one concrete local
type must appear in the impl declaration, in either the source type `T`
(the trait's argument) or the destination type `U` (the for-type).

Permitted:

```
fulfill From[i64] for MyMeasurement       // U is local ✓
fulfill From[MyMeasurement] for i64       // T is local (covers via §3.7.2) ✓
fulfill From[Vec[MyType]] for SomeType    // MyType is local, covering ✓
```

Rejected:

```
fulfill From[i64] for f64                  // ✗ neither type local — orphan
                                           //   (and language already provides this)
fulfill From[string] for Vec[i32]          // ✗ both string and Vec[i32] are foreign
```

The generic-parameter-coverage rule is particularly useful for conversions
*from* a user's type *to* a foreign type. A user owning `MyMeasurement`
can write `fulfill From[MyMeasurement] for i64` to define how their
measurement converts to a plain integer. The corresponding
`Into[i64] for MyMeasurement` auto-derives per §7.2.

For implementing a conversion between two foreign types — a relatively
rare need — the newtype pattern per §6.3.5 is the workaround: wrap one
of the foreign types in a local newtype, then implement the conversion
involving the newtype.

The auto-derivation of `Into` from `From` per §7.2 propagates this
constraint: the synthesized `Into[U] for T` impl exists at the same
module where the corresponding `From[T] for U` exists, and is bound by
the same orphan rule.

### 7.5 Built-in Numeric Conversions

The language pre-populates the conversion traits with built-in numeric
conversions per §4.5's lossless rules:

**`From` impls** (infallible) cover all lossless widening:

- Integer-to-wider-same-signedness (`i8` → `i32`, `u16` → `u64`, etc.).
- Unsigned-to-wider-signed (`u8` → `i16`, etc.).
- Float-to-wider-float (`f32` → `f64`).
- Integer-to-float for exact-representable cases (`i8`/`u8`/`i16`/`u16`
  → `f32`; `i32`/`u32` → `f64`).
- The §4.5.4 pragmatic exception: `From[i64] for f64` and
  `From[u64] for f64`.

**`TryFrom` impls** (fallible) cover narrowing, signed/unsigned crossings,
and lossy integer-to-float conversions. Each carries an appropriate
`Error` type (typically a numeric range error).

These built-in impls are language-privileged (§3.7.3) — they exist outside
user-writable `fulfill`-block space and cannot conflict with user code.

### 7.6 Relationship to `as`

The `as` operator (§4.7 for numeric, §6.3.2 for newtypes) is distinct
from the conversion-trait system but interacts with it for numeric cases:

- For **lossless numeric conversions**, `x as U` and `x.into::[U]()` (or
  equivalently `Into::into(x)` typed to `U`) produce the same result.
  Both are valid; users pick based on style. `as` is more concise; `.into()`
  is more uniform with user-defined conversions.
- For **lossy numeric conversions** that would overflow, `as` traps at
  runtime per §4.6.1; `as%` wraps; `as|` saturates; `as?` returns
  `Option[T]`. The fallible variant `try_into` returns
  `Result[T, Error]` for explicit handling with a typed error. The
  variants of `as` and `try_into` differ in what they signal: `as` and
  its variants express *value-level* range mismatches via the chosen
  policy (trap, wrap, clamp, optional); `try_into` expresses
  *trait-level* fallibility with a named `Error` type.
- For **newtype extraction**, `as` is the dedicated unwrap operation
  (§6.3.2). The conversion-trait system does not participate; the
  underlying value is exposed via the operator directly.
- For **user-defined conversions on non-newtype types**, `as` is not
  available. Users use `.into()`, `From::from()`, or `.try_into()` per
  §7.8.

The summary: `as` (with its variants) is the operator for built-in
numeric casts and newtype unwraps; the conversion traits are the
mechanism for everything else.

### 7.7 No Implicit User-Defined Conversions

User-defined `From` impls do *not* produce implicit conversions. The
implicit-conversion surface of the language is strictly limited to the
built-in lossless widenings specified in §4.5. A user implementing
`From[Celsius] for Fahrenheit` does not enable `let f: Fahrenheit = some_c`
without explicit invocation; the user writes `let f: Fahrenheit =
some_c.into()` or `let f: Fahrenheit = Fahrenheit::from(some_c)`.

This prevents the C-family hazard of action at a distance through
user-defined conversions. The set of types that auto-convert is fixed by
the language and discoverable from §4.5; user types never silently
participate in expression-level type adjustment.

The auto-derivation of `Into` from `From` (§7.2) is *not* an implicit
conversion — it is the auto-generation of a callable trait method.
Calling that method requires explicit syntax at the call site, dispatched
through uniform call syntax (§3.4).

### 7.8 Invocation Forms

Conversion calls use the standard uniform call syntax per §3.4 and follow
the argument-form rules per §3.5. Three explicit forms are available
universally; a fourth implicit form applies only to built-in lossless
widenings.

```
let x: f64 = (5_i32).into::[f64]()        // method form
let x: f64 = 5_i32 >> Into::into          // pipe-forward through trait path
let x: f64 = From::from(5_i32)            // free-function via trait path
let x: f64 = 5_i32                        // implicit (built-in lossless widening only)
```

The first three forms are explicit invocations and are available for all
`From`/`Into` impls — built-in and user-defined alike. The fourth is not
an invocation at all but the absence of one: it works only because
`i32` → `f64` is in the built-in lossless-widening set (§4.5.2), where
the compiler inserts the conversion silently. User-defined `From` impls
never participate in implicit conversion (§7.7).

The pipe-forward form `value >> Trait::method` works with generic trait
methods (like `Into::into`) when the target type can be inferred from
context — typically from an annotation on the binding (`let x: f64 = ...`)
or from a downstream constraint. When inference isn't sufficient, the
method form with explicit turbofish (`x.into::[U]()`) is the clearer
choice.

Fallible conversions return `Result[T, Error]` and typically chain through
the `?` operator (§8) for propagation:

```
let r: Result[i32, _] = big_value.try_into::[i32]()
fn parse_age(s: string) -> Result[Age, ParseError]:
  let n: i32 = s.parse::[i32]()?
  let age: Age = n.try_into::[Age]()?
  Ok(age)
```

The `?` operator's interaction with `From` for error-type conversion is
specified in §8 (and constrained per §7.9).

### 7.9 Error-Type Relationships in `?` Propagation

The `?` operator (§8) extracts the success value from a `Result` or
`Option`-typed expression. On failure, it propagates the failure value up
the call stack — terminating the current function early with a converted
failure if needed.

For propagation to succeed, the source's *error type* must be the same as
the destination function's error type, or be convertible to it via `From`:

```
fn parse_to_string(s: string) -> Result[string, ParseError]:
  let n: i32 = s.parse::[i32]()?      // source: Result[i32, ParseError]
                                       //   error types match: ParseError = ParseError ✓
  Ok(n.to_string())                    // function returns Result[string, ParseError]

fn read_and_parse(path: string) -> Result[i32, AppError]:
  let bytes: Vec[u8] = read_file(path)?   // source: Result[Vec[u8], IoError]
                                          //   IoError → AppError via From: ✓
  let s: string = parse_string(bytes)?     // source: Result[string, ParseError]
                                          //   ParseError → AppError via From: ✓
  let n: i32 = s.parse::[i32]()?
  Ok(n)
```

The success type at the `?` site becomes the type of the expression at
that site, bound to the local variable on the left or used inline.
Different `?` sites in the same function can produce different success
types — `?` does not impose any constraint between the source's success
type and the function's return success type. That contract is satisfied
separately, wherever the function actually returns `Ok(...)`.

The error-type rule:

- **Same error type:** trivially valid; no conversion.
- **Source error convertible to destination error via `From`:** the
  compiler inserts the `From::from` call automatically at the propagation
  site.
- **No relationship via `From`:** compile error at the `?` site,
  identifying the source and destination error types and the missing
  `From` impl.

This rule is the *only* relationship `?` enforces between source and
destination types. There is no implicit success-type coercion, no
fallback through arbitrary trait machinery, no silent type adjustment.
The `From`-bound error conversion is opt-in by the user (via implementing
`From[SourceError] for DestError`); without it, `?` is a hard type error.

This bounded model gives `?` predictable behavior: a reader sees `?` and
knows exactly two things — "extract success here; propagate error
upward, converting via `From` if the types differ." Anything more
elaborate happens through explicit `match` or method chains.

---

## 8. Error Handling

The language uses a two-track failure model. The distinction is made *at
the operation site* when writing code; once a failure has been encoded as
one kind, it cannot be silently converted to the other.

### 8.1 The Two-Track Model

**Trap-track failures** represent bugs and invariant violations:
arithmetic overflow on default operators per §4.6.1, integer division by
zero, out-of-range `as` casts, out-of-range array indices, `abs` on
signed minimum (§4.8), negative integer exponent on integer base
(§4.8.3), `unwrap`/`expect` on `Option::None` or `Result::Err`, runtime
stack overflow, allocation failure, and explicit `panic` calls. Traps
halt execution and produce diagnostics. They are *not* catchable as
values.

Non-exhaustive `match` expressions are a separate concern: they are
*compile errors* per §6.2.5, not runtime traps. The compiler statically
verifies exhaustiveness at every `match`; a non-exhaustive match never
compiles. If the user wants a runtime panic for "unreachable" cases,
they write an explicit catch-all arm calling `panic` (which produces a
trap via the standard mechanism).

**Value-track failures** represent recoverable conditions that flow
through the type system: `Option[T]` for failures carrying no
information beyond their occurrence, `Result[T, E]` for failures
carrying contextual information, the `?` operator for short-circuit
propagation (§8.4), the `Try` trait dispatching `?` to
user-implementable types, the `From`-conversion of failure types during
propagation (§7.9), and the arithmetic operator variants (`+?`, `-?`,
etc.) per §4.6.4 for producing `Option`-typed results from operations
that would otherwise trap.

The two tracks are not interchangeable:

- A trap does not become a `Result::Err` value.
- A `Result::Err` does not abort the program.
- There is no `try`/`catch` mechanism for traps.

The user picks the mechanism based on the failure's nature when writing
the code: traps for "this should never happen if the program is correct";
`Option`/`Result` for "this might legitimately happen at runtime and the
caller might want to handle it." The operator variants from §4.6 make
this choice visible at the operation level itself: `+` traps on overflow
(the "if this overflows, the program has a bug" choice); `+?` returns
`Option[T]` (the "the caller wants to handle the overflow case" choice).

### 8.2 The Trap Track

#### 8.2.1 `panic` and the `never` type

`panic` is a built-in function in the language prelude — available
without qualification in every scope. It has the signature:

```
fn panic(message: string) -> never
```

It triggers an immediate trap with the given diagnostic message. The
`never` return type allows `panic` to appear anywhere a value of any
type is expected, including inside `match` arms, conditional branches,
and function bodies that return non-unit types:

```
let value = match maybe_value:
  Some(x): x
  None: panic("expected Some, got None")
```

#### 8.2.2 The `never` type

`never` is a built-in primitive type with no values, written in lowercase
per the convention for primitive type keywords (§1.4). It is the return
type of functions that do not return normally — `panic`, infinite loops,
functions that always trap.

The compiler treats `never` as unifiable with any type during
type-checking: a value of type `never` can be used in any context
expecting any other type, because such a value can never actually exist
at runtime. This is the "bottom type" of type theory, exposed as an
ordinary primitive.

```
fn unreachable() -> never:
  panic("unreachable code reached")

let x: i32 = if condition: 5 else: unreachable()
                                    // unreachable() returns never;
                                    // unifies with i32 ✓
```

#### 8.2.3 Trap behavior at runtime

When a trap fires:

1. A diagnostic is printed including the operation that triggered the
   trap (with operand values where available), the source location
   (file, line, column), and a stack trace through the call chain.
2. The process exits.

There is no recovery mechanism. No `try`/`catch` exists for traps. No
unwinding hook can intercept and convert a trap to a value. The
philosophy: a trap signals a bug; the program is in a state the
programmer didn't anticipate; continuing risks further incorrect
behavior. Process abort is the safe response.

Once a trap fires, the program exits. The only way to handle a failure
recoverably is to use `Result`/`Option` from the start — and the
operator/method variants in §4.6 and §4.7 (e.g., `+?`, `as?`,
`checked_div`) make this choice available where overflow or range
violation is a possibility. The user decides at the operation site
whether a failure is a bug to be trapped or a condition to be handled.
Choosing wrong at that point cannot be retroactively patched by a
`catch` block; the language forces the decision upfront, which is the
principal mechanism for keeping the two failure tracks honest.

#### 8.2.4 Diagnostic format

The diagnostic format includes the operation name and operand values
where the runtime has access to them:

```
panic: integer overflow: 2147483647 + 1
  at compute_total, src/billing.symphony:42:8
  called from main, src/main.symphony:7:3
```

For user-triggered `panic` calls, the diagnostic includes the
user-supplied message:

```
panic: expected Some, got None
  at process_input, src/handler.symphony:24:10
```

Format details are implementation-level. The semantic commitment is that
diagnostics provide sufficient information to identify what trapped,
where, and through what call chain.

### 8.3 The Value Track: `Option` and `Result`

`Option[T]` and `Result[T, E]` are standard library types built from the
generic enum mechanism per §6.2. They are ordinary enums with no
language-level special-casing of their identity. Their stdlib
definitions:

```
enum Option[T]:
  Some(T)
  None

enum Result[T, E]:
  Ok(T)
  Err(E)
```

The interactions that look special — the `?` operator (§8.4), the
error-conversion chains via `From` (§8.5) — are mediated through a
stdlib trait (`Try`), not through compiler knowledge of these specific
types. Any user-defined type can participate in `?` propagation by
implementing `Try` per §8.4.

#### 8.3.1 Pattern matching

`Option` and `Result` use standard exhaustive `match` per §6.2.4:

```
match maybe_value:
  Some(x): use_it(x)
  None: handle_absence()

match operation:
  Ok(value): proceed(value)
  Err(error): handle_error(error)
```

No special `if let` or check-and-unwrap sugar is provided in v1. The
combination of `match` (for full discrimination) and `?` (for
short-circuit propagation) covers the common cases. The language
surface is intentionally minimal; sugar may be added later if usage
patterns reveal a sharp need.

### 8.4 The `?` Operator and the `Try` Trait

The `?` postfix operator (grammar §3.15) dispatches through a stdlib
trait, `Try`, that decomposes a value into either a "continue with this
success value" or "break with this failure value":

```
trait Try:
  type Success
  type Failure
  fn branch(value: Self) -> TryBranch[Success, Failure]

enum TryBranch[S, F]:
  Continue(S)
  Break(F)
```

`Option` and `Result` fulfill `Try` in stdlib:

- `Try::branch(Some(x))` → `Continue(x)`; `Try::branch(None)` →
  `Break(None)`.
- `Try::branch(Ok(x))` → `Continue(x)`; `Try::branch(Err(e))` →
  `Break(Err(e))`.

User types may implement `Try` to make `?` available on their own
optional-or-result-like types.

#### 8.4.1 Desugaring

The `?` operator desugars to a `match` on the trait method's result,
with the failure branch returning from the enclosing function and
applying `From`-conversion to bridge failure types:

```
expr?
```

desugars to:

```
match Try::branch(expr):
  Continue(value): value
  Break(failure): return From::from(failure)
```

The `From::from(failure)` automatically converts the failure value into
the enclosing function's failure type. When the failure types are
identical, `From::from` is the trivial identity conversion (§7.3); no
special-case logic is needed for matching types.

### 8.5 Error-Type Conversion via `From`

The `From::from(failure)` step in `?` propagation enables error-type
chains: a function returning `Result[T, MyError]` can use `?` on any
`Result[U, OtherError]` provided `fulfill From[OtherError] for MyError`
exists. The conversion is invisible at the call site but typed
end-to-end; the compiler verifies the `From` impl exists at every `?`
use site, rejecting with a clear error when no path is found.

Full rules for the error-type relationship are specified in §7.9. In
brief:

- Same error type: trivially valid.
- Source error convertible to destination error via `From`: implicit
  conversion at the propagation site.
- No relationship via `From`: compile error at the `?` site.

The success type at the `?` site becomes the local expression's value
and has no relationship to the function's return success type — the
function's `Ok(...)` site satisfies that contract separately.

### 8.6 No Cross-Type `?`

Using `?` on an `Option` value inside a function returning `Result`, or
on a `Result` value inside a function returning `Option`, is a compile
error. The failure-type families are fundamentally different:

- `Option`'s `None` carries *no information*.
- `Result`'s `Err` carries *an error value*.

Silently bridging them would require either fabricating an error value
from `None` (which information is invented?) or discarding an error
value when going to `Option` (information is lost). Both lose
information that should be explicit at the call site.

The user converts explicitly via stdlib methods (§8.7):

- `option.ok_or(err)` — where `err: E` is the error value to use for
  `None` — produces `Result[T, E]` from `Option[T]`.
- `result.ok()` produces `Option[T]` from `Result[T, E]`, discarding
  the error.

The conversion is visible at the call site; the failure-handling
decision is explicit.

### 8.7 Standard Methods

Stdlib provides a standard set of methods on `Option` and `Result`.
The non-exhaustive list:

#### 8.7.1 `Option[T]`

- `unwrap(value: Self) -> T` — returns the value or traps if `None`.
- `expect(value: Self, msg: string) -> T` — like `unwrap` with custom
  trap message.
- `unwrap_or(value: Self, default: T) -> T` — returns the value or the
  default.
- `unwrap_or_else(value: Self, f: fn() -> T) -> T` — returns the value
  or a computed default.
- `map[U](value: Self, f: fn(T) -> U) -> Option[U]` — applies a
  function to the success value.
- `and_then[U](value: Self, f: fn(T) -> Option[U]) -> Option[U]` —
  chains optional computations.
- `or_else(value: Self, f: fn() -> Option[T]) -> Option[T]` — fallback
  computation.
- `ok_or[E](value: Self, err: E) -> Result[T, E]` — converts to
  `Result` with the given error on `None`.
- `is_some(value: Self) -> bool`, `is_none(value: Self) -> bool` —
  discriminator predicates.

#### 8.7.2 `Result[T, E]`

- `unwrap(value: Self) -> T` — returns success or traps on `Err`.
- `expect(value: Self, msg: string) -> T` — like `unwrap` with custom
  trap message.
- `unwrap_or(value: Self, default: T) -> T`,
  `unwrap_or_else(value: Self, f: fn(E) -> T) -> T`.
- `map[U](value: Self, f: fn(T) -> U) -> Result[U, E]` — transforms the
  success value.
- `map_err[F](value: Self, f: fn(E) -> F) -> Result[T, F]` — converts
  the error type.
- `and_then[U](value: Self, f: fn(T) -> Result[U, E]) -> Result[U, E]`
  — chains fallible computations.
- `or_else[F](value: Self, f: fn(E) -> Result[T, F]) -> Result[T, F]`
  — error-recovery chain.
- `ok(value: Self) -> Option[T]`, `err(value: Self) -> Option[E]` —
  convert to `Option`, discarding the other arm.
- `is_ok(value: Self) -> bool`, `is_err(value: Self) -> bool` —
  discriminator predicates.

All methods listed above are *free functions* defined in stdlib, callable
through uniform call syntax per §3.4 (records and enums carry no methods
of their own per §6.1.9 and §6.2.6). The following are equivalent:

```
option.unwrap()
option >> unwrap
unwrap(option)
std::option::unwrap(option)        // module-path qualification
```

The module-path form `std::option::unwrap(option)` is used to
disambiguate when multiple `unwrap` free functions are in scope (e.g.,
the `unwrap` in `std::option` and the `unwrap` in `std::result`). Path
qualification follows the module-path rules in §10. There is no
`Option::unwrap(option)` (type-qualified) form: free functions live in
modules per §10, not associated with types, and the dispatch model in
§3.4 does not include a type-qualified free-function namespace.

### 8.8 Convention: `Option` vs `Result`

The choice between `Option` and `Result` is convention, not a language
rule:

- Use `Option[T]` when the failure case carries no information beyond
  its occurrence (e.g., `find_first(predicate)` — the element exists or
  it doesn't; there's nothing more to say).
- Use `Result[T, E]` when the failure case carries information the
  caller may want to inspect or react to (e.g., `read_file(path)` —
  the caller often wants to know whether the failure was missing-file,
  permission-denied, or transient I/O error).

When in doubt, prefer `Result`. Information about failure is rarely too
much; the absence of information makes debugging harder. The compiler
accepts either signature; users choose based on what callers need.

### 8.9 Error Handling in the Reactive Context

The reactive system (deferred to a later section) uses the same
two-track failure model. A trap inside a `derived` expression's
computation propagates as a normal trap — the reactive system does not
catch traps. A `derived` declaration whose expression has type
`Result[T, E]` or `Option[T]` produces a reactive value of that type;
consumers of the derived value handle the failure case using standard
`match` or `?` propagation. The reactive layer adds no special error
mechanism beyond what already exists in the type system.

---

## 9. Strings, Tuples, and Arrays

This section specifies three foundational compound types that are
not user-defined: `string` (a primitive built-in), tuples (structural
anonymous products), and fixed-size arrays (`T[N]`). All three have
dedicated syntax and language-level treatment; their behaviors are
specified here rather than emerging from the trait system alone.

### 9.1 Strings

`string` is a built-in primitive type, at the same level as `i32` or
`bool`. The compiler has direct knowledge of it; it is not a stdlib type
with privileged literal syntax. The built-in status enables compiler-level
optimizations (small-string optimization, intern pools, constant folding
of string literals per §2.4) without dependency on a stdlib
implementation. The lowercase `string` keyword is reserved, matching the
lowercase convention for primitive types (§1.4).

#### 9.1.1 Primitive non-numeric types

The complete set of primitive non-numeric types in the language is:

- `bool` — the truth-value type.
- `char` — a Unicode scalar value (see §9.1.2).
- `string` — UTF-8-encoded sequences of `char` values (see §9.1.3 onward).

No other non-numeric primitives exist. Byte sequences are `u8[N]` arrays
(§9.3). Other text-related types (UTF-16 strings, ASCII-only strings,
byte strings with no encoding) are stdlib concerns if needed; the language
commits to one string type, and that type is UTF-8.

#### 9.1.2 The `char` type

`char` represents a Unicode scalar value — an integer in the range
`0..=0xD7FF` ∪ `0xE000..=0x10FFFF`. The excluded range
(`0xD800..=0xDFFF`) is reserved for UTF-16 surrogate pairs and is not a
valid scalar value. A `char` value is always a valid Unicode scalar; the
type system rejects values outside this range at construction time.

Representation is 32-bit per value (`char` does not vary in size despite
representing a code-point range that fits in 21 bits — fixed width
enables direct indexing of `char` sequences).

**Character literals** use single quotes:

```
let c1: char = 'a'
let c2: char = '\n'                 // newline
let c3: char = '\t'                 // tab
let c4: char = '\\'                 // literal backslash
let c5: char = '\''                 // literal single quote
let c6: char = '\u{1F600}'          // 😀  (escape for any Unicode scalar)
let c7: char = '\x41'               // 'A' (escape for ASCII byte)
```

The same escape conventions as string literals (§9.1.3) apply. A
character literal contains exactly one Unicode scalar; multi-character
literals are a compile error.

**Conversion with integers** uses the conversion-trait system per §7:

- `From[char] for u32` — every `char` converts to a `u32` losslessly
  (a Unicode scalar fits in 21 bits, well within u32's range).
- `TryFrom[u32] for char` — only valid Unicode scalar values produce
  a `char`; surrogate-pair range and values above `0x10FFFF` produce
  `Err`.

`char` is `Eq`, `Ord`, `Hash`, `Display`, `Debug`, and `Clone` — the
standard trait set for primitive scalar types. Comparison and ordering
follow numeric Unicode scalar value order.

**Relationship to strings**: A `string` is conceptually a sequence of
`char` values encoded as UTF-8. The `chars()` view (§9.1.6) produces a
`char` sequence; the `chars` method's complexity is O(n) because UTF-8
decoding is required to extract each `char`.

#### 9.1.3 String literals

String literals follow grammar §2.5.5:

- **Plain strings**: `"hello world"`.
- **Raw strings**: `r"no \n escapes"`, `r#"with "quotes""#`.
- **Escape sequences**: `\n`, `\t`, `\\`, `\"`, `\xHH`, `\u{HHHHHH}`.
- **Interpolation**: `"user {name} has {count} items"`.

All forms produce values of type `string`.

#### 9.1.4 UTF-8 invariant

UTF-8 is the internal encoding. Strings are sequences of bytes
interpretable as UTF-8; the type system guarantees that every string
value is valid UTF-8. No invalid-UTF-8 string can exist at runtime;
constructors and conversions that take untrusted input either reject
ill-formed input or return a fallible result.

#### 9.1.5 No direct indexing

Strings are opaque with respect to indexing — there is no `s[i]`
operator. Direct indexing is rejected as a footgun:

- Byte indexing produces meaningless results when an index lands
  mid-codepoint in a multi-byte UTF-8 sequence.
- Character indexing is O(n) (since UTF-8 is variable-width) and would
  silently hide that cost behind constant-time-looking syntax.
- Both invite subtle bugs that only surface on non-ASCII input.

Access to string contents requires explicit views per §9.1.6.

#### 9.1.6 Views and queries

Access to string contents uses explicit methods that make the unit of
measurement visible at every call site:

- `s.bytes()` — returns a sequence of `u8` values representing the
  raw bytes. Indexable in O(1), but the user is responsible for
  UTF-8-aware handling of multi-byte sequences. The exact return type is
  a stdlib concern.
- `s.chars()` — returns a sequence of `char` values (Unicode scalars).
  Iterable in O(n) total traversal. The exact return type is a stdlib
  concern.
- `s.byte_len() -> isize` — length in bytes. O(1).
- `s.char_count() -> isize` — number of Unicode scalars. O(n).

Each name describes both the operation and its complexity-relevant unit.
Users choose the appropriate view for their workload; the language does
not pick a default that would be wrong for some cases.

#### 9.1.7 Slicing

Slicing uses explicit methods rather than range syntax:

- `s.slice(start: isize, end: isize) -> string` — char-boundary slicing.
  `start` and `end` are character positions. Boundaries are validated.
  Cost is O(end) — char boundaries are located by walking UTF-8 from the
  start, since UTF-8 is variable-width.
- `s.byte_slice(start: isize, end: isize) -> string` — byte-boundary
  slicing. `start` and `end` are byte positions. Traps if a boundary
  lands mid-codepoint (which would produce invalid UTF-8). Cost is
  O(1) for boundary lookup; the validation requires reading the byte at
  each boundary to verify it does not fall inside a multi-byte sequence,
  still O(1) per boundary.

Both methods return a new string value. Invalid boundaries
(mid-codepoint byte index, out-of-range positions) trap at runtime per
§4.6.1's trap-on-error philosophy.

#### 9.1.8 Immutability and operations

Strings are immutable, consistent with all bindings in the language per
§1.3. There is no in-place mutation. Every string operation that
produces modified content returns a new string value:

```
let upper = s.to_upper()
let trimmed = s.trim()
let replaced = s.replace(old, new)
let combined = a + b
```

The runtime is free to share immutable backing storage between values,
but this is an implementation detail invisible to the user.

The `+` operator concatenates strings per §4.4's operator framework.
The language provides an `Add` implementation for `string` (per §3.7.3's
language-privileged impls) with both operands and result typed as
`string`:

```
let greeting = "hello" + " " + "world"
```

#### 9.1.9 Interpolation

Interpolation is the preferred form when building strings from
non-string values, per grammar §2.5.5:

```
let label = "user {name} has {count} items"
let summary = "value: {amount * tax_rate}"
```

The interpolation expression `{expr}` evaluates the expression and
converts the result to `string` via the `Display` trait per §3.7. Values
whose types do not satisfy `Display` produce a compile error at the
interpolation site.

Interpolation expressions are arbitrary expressions, including method
calls, arithmetic, and field access. They are not limited to bare
identifiers.

### 9.2 Tuples

Tuples are *structurally typed* — the one structural-typing carve-out in
an otherwise nominal type system. Two tuples with the same component
types in the same order are the same type:

```
(1, 2)         // (i32, i32)
(3, 4)         // also (i32, i32) — same type as above
(1, "hello")   // (i32, string) — a different type
```

No type declaration is required to use a tuple type; the type expression
`(T1, T2, ...)` denotes the tuple type directly. The structural-typing
carve-out is justified by the fact that tuples are anonymous product
types by design and carry no domain identity — there is no nominal
contract to preserve.

#### 9.2.1 Field access

Field access uses numeric postfix syntax per grammar §3.15:

```
let t = (1, "hello", 3.14)
let n = t.0          // i32
let s = t.1          // string
let f = t.2          // f64
```

Indices are zero-based and must be **integer literals**. Bounds checking
happens at compile time: `t.3` on a 3-tuple is a compile error.

The literal restriction is structural: tuple components can have
different types, and the compiler must know the type of the accessed
field statically. Runtime indexing with a variable expression (`t.i`
where `i` is a binding) is not permitted because the type of the result
would depend on a runtime value, which the type system cannot express.

#### 9.2.2 Pattern destructuring

Tuple patterns follow grammar §3.14's `TuplePat`:

```
let (a, b, c) = (1, "hello", 3.14)
let (x, _, z) = some_tuple
let ((a, b), c) = ((1, 2), 3)
```

Tuple patterns appear in `let` bindings, `match` arms, and any other
position where patterns are admitted. Nested tuple patterns work to
arbitrary depth. The wildcard `_` ignores a component without binding it.

Tuple patterns are always positional per §3.5 — tuples have no field
names, so there is no named form.

#### 9.2.3 The unit type `()`

The unit type is `()`, with a single value also written `()`. Functions
without a final expression per grammar §3.13 return the unit value
implicitly. The unit type appears in pattern position as `()` to match
unit-typed values and as a type expression for return types of functions
producing no meaningful value:

```
fn print_hello() -> ():
  println("hello")

fn print_hello():          // same as above; -> () may be omitted
  println("hello")
```

#### 9.2.4 The 1-tuple

The 1-tuple form requires a trailing comma to disambiguate from a
parenthesized expression:

```
let single = (42,)         // 1-tuple of type (i32,)
let grouped = (42)         // just i32 in parens — not a tuple
```

The trailing-comma convention is standard across languages with tuple
support and resolves the syntactic ambiguity cleanly.

#### 9.2.5 Generics over tuples

Generic parameters appear in tuple types using standard generic syntax;
no special mechanism is needed:

```
fn first[A, B](t: (A, B)) -> A:
  t.0

fn swap[A, B](t: (A, B)) -> (B, A):
  (t.1, t.0)
```

The tuple type `(A, B)` is a type expression like any other; `A` and `B`
are bound by the generic parameter list. Per §2.3, each unique
tuple-type instantiation produces its own specialized code.

**Variadic generics** — abstraction over tuples of arbitrary arity — are
not supported in v1. Functions generic over "any tuple" would require
either macro support or a different abstraction mechanism (e.g., a trait
with associated types for each component). May be added later if usage
patterns justify the complexity. For now,
generic-over-tuple-component-types covers the common case.

#### 9.2.6 Trait conformance for tuples

Trait conformance for tuples is supported via `fulfill` blocks per §3.3,
subject to the orphan rule from §3.7 — including the
generic-parameter-coverage rule from §3.7.2. Since tuple types are
structural and not declared in any module, the coverage check operates
on the tuple's element types:

- A `fulfill SomeTrait for (T1, T2, ...)` is permitted if `SomeTrait` is
  local *or* if at least one of the element types `Ti` is local.
- For tuples consisting entirely of foreign types (e.g., `(i32,
  string)`), the trait must be local — no element provides coverage.
- For tuples containing at least one locally-defined element type
  (e.g., `(i32, MyType)` where `MyType` is local), coverage is satisfied
  via that local element, and a foreign trait can be implemented.

```
// In user module declaring MyTrait and MyType:
fulfill MyTrait for (i32, string):          // ✓ trait is local
  ...

fulfill Display for (i32, MyType):          // ✓ MyType covers; Display is foreign
  ...

fulfill Display for (i32, string):          // ✗ both element types foreign,
                                            //   trait also foreign — orphan
  ...
```

Stdlib provides `fulfill` blocks for common tuple types implementing
common traits (`Eq`, `Ord`, `Hash`, `Clone`, `Display`, `Debug`).
Coverage extends through **tuple arity 12** — beyond arity 12, users
implement explicitly. The arity limit reflects the practical observation
that tuples larger than 12 components are rare and typically indicate
the user should be using a record (§6.1) instead.

#### 9.2.7 Tuple-to-record conversion

Tuple-to-record conversion is explicit. Tuples are structural; records
are nominal; they do not share identity, and the compiler does not
implicitly convert between them. Manual conversion uses field-by-field
construction:

```
let t = (1.0, 2.0, 3.0)
let v = Vec3(x: t.0, y: t.1, z: t.2)
```

For ergonomic repeated conversion, a `From` impl per §7 produces
method-call conversion:

```
fulfill From[(f32, f32, f32)] for Vec3:
  fn from(t: (f32, f32, f32)) -> Vec3:
    Vec3(x: t.0, y: t.1, z: t.2)

// Now:
let v: Vec3 = (1.0_f32, 2.0_f32, 3.0_f32).into::[Vec3]()
```

### 9.3 Arrays

Arrays are fixed-size, contiguous sequences of values of a single
element type. The element count is part of the type. Arrays receive
dedicated language syntax (`T[N]`) rather than being expressed through a
generic stdlib type.

#### 9.3.1 Array type syntax

```
i32[5]              // 5-element array of i32
string[10]          // 10-element array of string
f64[100]            // 100-element array of f64
```

The syntax `T[N]` is dedicated to the array type. There is no exposed
canonical `Array[T, N]` form; the underlying array representation is
internal to the compiler and not addressable by name in user code. The
syntactic shape parallels how tuples are handled — dedicated syntax with
no namespace-level type name.

**Multi-dimensional arrays** parse left-to-right: `T[N][M]` is an
M-element array of `T[N]`. To form an N-row × M-column matrix, write
`f64[M][N]` (each row is `f64[M]`; the outer array has `N` such rows).

**Zero-length arrays** `T[0]` are valid types. They are useful for edge
cases in generic code that must abstract over array sizes including
zero, and for FFI bindings to C-style flexible array members.

#### 9.3.2 Disambiguation of `T[args]` in type position

The grammar's `TypePostfixOp` is uniformly `[arg-list]`. The compiler
interprets it based on what `T` resolves to:

- If `T` is a primitive or other non-generic type, `T[args]` constructs
  the array type (e.g., `i32[5]`, `string[10]`).
- If `T` is a generic type, `T[args]` instantiates the generic with the
  given type arguments (e.g., `Vec[i32]`, `Option[string]`).

The disambiguation is by the kind of `T`, not by the kind of the
arguments. A primitive type's name is always an array-type constructor;
a generic type's name is always a generic-instantiation site. There is
no ambiguity at the parser level.

#### 9.3.3 Length type

The array length type is `isize` — signed, platform-sized. The choice
of signed reflects a real ergonomic concern: `length - 1` on an empty
array under unsigned would either wrap to `usize::MAX` (likely freezing
loops) or trap; under signed it yields `-1`, and the iteration `0..-1`
is correctly empty.

The platform-sized choice scales addressing capacity with the machine.
The theoretical halving of addressable size from `usize` to `isize` is
not a real constraint: `isize::MAX` on 64-bit platforms is
~9.2 × 10¹⁸ elements, far beyond any conceivable array.

Users needing the "must be non-negative" invariant for low-level work
(allocation sizes, FFI) can use `usize` explicitly; the language does
not block this.

#### 9.3.4 Index type

Array index types are flexible. Any integer type is accepted as an
index, implicitly widened to `isize` for the indexing operation per
§4.5's lossless-widening rules. Integer types whose value range fits
entirely in `isize`'s range widen losslessly; types whose range exceeds
`isize`'s range require explicit cast.

On 64-bit platforms (where `isize` is 64-bit), this means every integer
type up to and including `i64` widens losslessly; `u64`, `i128`, and
`u128` require explicit cast. On 32-bit platforms (where `isize` is
32-bit), the corresponding rule applies with `isize`'s narrower range.
The rule is platform-aware: the same source code is valid on every
platform, but a cast may be required on platforms with narrower `isize`
that would be unnecessary on wider platforms.

Users write indexing expressions with whichever integer type is natural
for their context — counter variables, sizes, computed offsets — and
the compiler handles the widening:

```
let i: i32 = 3
let v: i32 = arr[i]            // i32 widens to isize for indexing

let n: usize = compute()
let w = arr[n]                  // usize widens to isize for indexing

let big: u64 = some_huge()
let x = arr[big]                // ✗ compile error on 64-bit (u64 doesn't fit isize);
                                //   may also fail on 32-bit
let x = arr[big as isize]       // ✓ explicit cast
```

#### 9.3.5 Bounds checking

Bounds checking on `arr[i]` traps at runtime if `i < 0 || i >= length`,
consistent with §4.6.1's trap-on-out-of-range philosophy. The trap is
the language's signal that a logic error occurred — the program was
asked to access a position that doesn't exist.

When both the index and the length are compile-time known per §2.4,
bounds checking happens at compile time and produces a compile error on
out-of-range access:

```
let arr: i32[5] = ...
let x = arr[10]                 // ✗ compile error — 10 not in 0..5
let x = arr[3]                  // ✓ compile-time-verified safe
```

For recoverable indexing (where out-of-bounds should produce a value,
not a trap), the user calls stdlib methods like `arr.get(i)` returning
`Option[T]`, or uses the `?` variant per §4.6.4 if such an indexing
operator is provided.

#### 9.3.6 Dynamic arrays are not in the language

The dynamic-sized vector type (heap-allocated, growable) is a standard
library concern, not a language-level type. Its name and syntax (`Vec[T]`,
`Vector[T]`, or whatever stdlib chooses) is outside this specification.
Only fixed-size arrays receive dedicated language syntax. Stdlib's
dynamic collections are ordinary generic types per §2.

---

## 10. Visibility and Modules

The language uses a three-level visibility model — `public`, `shared`,
and `private` — and a folder-as-module structure for organizing code
within and across packages. This section is the authoritative
specification for both. Earlier sections cross-reference here for
declaration-specific behavior.

### 10.1 The Three Levels

Visibility is three-level. Each level denotes a distinct scope:

| Level | Scope | Default? |
|---|---|---|
| `public` | Across package boundaries — exported to dependent packages | no |
| `shared` | Within the same package (the module tree rooted at the package root) | **yes** |
| `private` | Within the declaring file only | no |

`shared` is the default; no keyword is required. `public` and `private`
are explicit keywords.

The three levels are linearly ordered by permissiveness:
`private < shared < public`. A declaration's visibility level determines
the maximum reach of any reference to it; references from outside that
reach produce compile errors at the reference site.

### 10.2 Packages and Modules

A *package* is the unit of distribution — a project root or a named
dependency. Each package has a single *package root*: the top-level
folder of the package's source tree. The package root is itself the
*root module*, addressed in absolute paths via the `root` keyword.
Subfolders of the package root are submodules; for example, the folder
`<package_root>/audio/` is the module accessible as `root::audio`.

A *module* is a folder of source files within a package. Files within
a folder share a path prefix — the folder's module path — and form a
single module's content. The folder structure of the source tree
mirrors the module path structure.

#### 10.2.1 Visibility reach

The three visibility levels translate to declaration reach as follows:

- A `private` declaration is reachable only from within its declaring
  file. No other file — sibling, parent, child, or unrelated — can
  reference it.
- A `shared` declaration is reachable from any file within the same
  package, including the declaring file itself, sibling files in the
  same folder, files in parent or descendant folders, and files in
  unrelated folders of the same package. Cross-file access requires
  either a `use` statement (§10.4) or a path-qualified reference.
- A `public` declaration is reachable from any file within the same
  package (as for `shared`), plus any file in any package that depends
  on the source package. Cross-package references go through the
  dependent package's external dependency path base per §10.2.2.

Cross-file access — same-folder or cross-folder — always requires
explicit reference, either via `use` or via path qualification. There is
no implicit "sibling files see each other" mechanism. The folder
structure determines the module path; it does not grant implicit
mutual visibility.

#### 10.2.2 Path bases

The grammar's `PathBase` (per grammar §3.4) provides the following entry
points for absolute paths:

- `root` — the current package's root module.
- A bare name matching an external dependency declared in the package's
  manifest — that dependency's root module.

For example, `root::audio::Synthesizer` resolves an absolute path
through the current package; `tone_lib::Oscillator` resolves into the
`tone_lib` dependency's public surface.

### 10.3 Visibility Specifiers on Declarations

Every position in the grammar that admits a visibility specifier
accepts one of: `public`, `shared`, `private`, or *absence* (which
denotes `shared` by default). The grammar's older `pub` keyword is
replaced throughout by this three-level model; the propagation covers
all visibility-bearing productions (grammar §3.4 through §3.11).

```
public fn render_frame(...): ...           // exported across packages
fn compute_delta(...): ...                 // shared (default)
private fn internal_helper(...): ...       // file-local

public type Synthesizer:                   // type public
  ...

private const SECRET_KEY: u64 = 0xDEADBEEF // file-local constant
```

Specific visibility rules for each declaration kind are specified in the
declaration's own section and summarized below:

- **Records** (§6.1): type visibility (§6.1.7), independent field
  visibility (§6.1.6), independent constructor visibility (§6.1.7).
- **Enums** (§6.2): type visibility applies uniformly to all variants
  (§6.2.6); no per-variant visibility.
- **Newtypes** (§6.3): type visibility (§6.3.1), independent
  constructor visibility (§6.3.4).
- **Traits** (§3.1): type visibility. Visibility of methods within a
  trait declaration is uniform with the trait's visibility — no
  per-method visibility.
- **Free functions**: visibility specifier on the `fn` declaration.
- **Constants** (§2.4.1.1): visibility specifier on the `const`
  declaration.
- **Fulfill blocks** (§10.8): no separate visibility specifier —
  reachability derived from trait and type visibility jointly.

### 10.4 `use` Statements

A `use` statement imports a name from another module into the current
file's scope, allowing the file to refer to that name unqualified rather
than via its full path. The grammar of `use` is specified in grammar
§3.3.

```
use root::audio::Synthesizer

let s = Synthesizer(...)              // unqualified — would be
                                      // root::audio::Synthesizer(...) otherwise
```

`use` has **no visibility modifier**. It is a usage-side construct: it
controls how the current file refers to other names, not how other files
refer to the current file. A name brought into scope via `use` does not
become a declaration in the current file; it remains the original
declaration in the original module, just with a shorter local reference.

The visibility of the imported declaration governs whether the `use` is
permitted at all. Importing a `private` declaration from another file
is a compile error (the source isn't visible). Importing a `shared`
declaration from within the same package works; importing it from another
package does not. Importing a `public` declaration works from any package
that depends on the source's package.

#### 10.4.1 Selective and glob imports

Per §6.2.3, selection lists on `use` paths use parentheses; a glob
imports every visible name from the source:

```
use root::ops::(add, sub, mul)        // specific names
use root::variants::*                 // glob: every visible name
```

Glob imports are subject to the import-time conflict rules per §6.2.3:
two glob imports that bring colliding names into the same scope produce
a compile error at the `use` site that introduces the second collision.

#### 10.4.2 Re-exporting a name

To make a declaration accessible from another module under a different
path, write an explicit re-declaration rather than a re-exporting
`use`. Common forms:

```
// In root::facade.symphony:
public alias type Synthesizer = root::audio::internal::Synthesizer
                                       // alias type form (§4.2)

public fn build_default() -> Synthesizer:
  root::audio::internal::build_default_with_params(...)
                                       // wrapper function
```

These are ordinary declarations with their own visibility specifiers,
distinct from `use` imports. The language's `use` machinery is solely
about bringing names into the current file's scope; cross-module
exposure of names is the job of declarations.

### 10.5 Type Visibility and Constructor Visibility

Records (§6.1.7) and newtypes (§6.3.4) carry an independent constructor
visibility specifier alongside the type visibility. The syntax uses a
parenthesized modifier on the type visibility keyword:

```
public type Email:                        // type public, constructor public (default)
  wraps string

public(shared) type Email:                // type public, constructor shared
  wraps string

public(private) type Email:               // type public, constructor private
  wraps string                            //   — the smart-constructor pattern

shared(private) type SecretConfig:        // type shared, constructor private
  api_key: string
```

The outer keyword is type visibility; the parenthesized inner keyword is
constructor visibility. When the inner specifier is omitted, constructor
visibility defaults to match the type's visibility.

**Inner ≤ outer.** The inner specifier may never be *more* permissive
than the outer. `private(public)` is a compile error — a public
constructor on a private type is unreachable from anywhere outside the
type's visibility scope and would be a dead specifier.

#### 10.5.1 The smart-constructor pattern

The `public(private)` and `shared(private)` configurations are the
canonical smart-constructor pattern: the type's name is visible across
its visibility scope (so callers can use it in signatures, annotations,
and field types), but construction `TypeName(...)` is unreachable from
outside the constructor's scope.

This is the language's mechanism for enforcing invariants at
construction time. Any path that produces a value of the type must pass
through the constructor's visibility scope, where validating logic — a
`From` impl, a `TryFrom` impl, a factory function — can be defined.
Callers receive values of the type that have passed the invariants;
they cannot manufacture invalid values directly.

### 10.6 Enum Visibility

Enum visibility applies uniformly to the enum type and all its variants
(§6.2.6). There is no per-variant visibility specifier.

```
public enum Color:                        // all variants public
  Red
  Green
  Blue

private enum InternalState:               // type and all variants file-local
  Pending
  Running
  Done
```

If a user needs some variants visible and others hidden, they split the
enum into multiple enums (each with its own visibility) and provide
conversion functions between them. The motivation: per-variant
visibility is rare in practice; supporting it would complicate the
grammar and module-resolution rules for narrow benefit.

### 10.7 Field Visibility

Records carry independent visibility per field (§6.1.6). Each field
declares its own visibility:

```
public type Account:
  public id: i64                  // readable anywhere the type is visible
  email: string                   // shared (default)
  private password_hash: string   // readable only within this file
```

A field's visibility never exceeds the enclosing type's visibility —
declaring a `public` field on a `private` type is a compile error,
because no caller outside the type's visibility scope could observe the
field.

Access from outside a field's visibility scope is a compile error at
the access site.

### 10.8 Trait `fulfill` Block Visibility

`fulfill` blocks (§3.3) have *no separate visibility specifier*. The
implementation's effective visibility is:

```
impl_visibility = min(trait_visibility, type_visibility)
```

where the visibility levels are ordered `private < shared < public`.
An implementation is callable wherever both the trait and the type are
visible — the intersection of their reachability.

Concrete cases:

| Trait visibility | Type visibility | Impl visibility |
|---|---|---|
| `public` | `public` | `public` (anywhere both are visible) |
| `public` | `shared` | `shared` (package-internal) |
| `shared` | `public` | `shared` (package-internal) |
| `private` | `public` | `private` (only in the trait's file) |
| `private` | `private` | only if both declared in same file |

The intersection rule reflects the practical observation: if a caller
can't name both the trait and the type, the implementation is
unreachable from that caller's site regardless of any separate
visibility specifier on the `fulfill` block.

The motivation for *not* having a separate visibility specifier: a
separate specifier could create the case where the trait and type are
both visible but the implementation is not, leading to confusing
"method not found" errors when the implementation clearly should exist.
Coherence per §3.7 guarantees at most one implementation exists per
(trait, type) pair, so there is no ambiguity in which implementation is
the visible one — only whether it is reachable.

### 10.9 Visibility and the Orphan Rule

The orphan rule (§3.7) operates on the *module-of-declaration*, not on
visibility. A `fulfill` block satisfies the orphan rule if the trait or
the type is declared locally — regardless of either's visibility level.
Visibility controls *who can see and use* an implementation; the orphan
rule controls *where it can be declared*.

A `private` trait or type still counts as "local" for orphan-rule
purposes. The combination — a `fulfill` block for a private trait and a
foreign type, with the implementation accessible only inside the
declaring file — is rare but valid.

### 10.10 Visibility and Dispatch

Visibility interacts with the uniform call syntax (§3.4) through name
resolution. A method call `x.f()` resolves `f` against names visible in
the current scope; visibility determines which names are reachable from
the call site:

- A `private` function is reachable only from within its declaring file.
- A `shared` function is reachable from any file within the same package
  via a `use` statement bringing it into scope, or via path
  qualification.
- A `public` function is reachable as for `shared`, plus from any file
  in any package depending on the source package.

In all cross-file cases — same-folder or cross-folder, same-package or
cross-package — the reference is explicit: either the name is brought
into scope via `use`, or the call uses a path-qualified form like
`root::module::function_name(args)`.

The resolution algorithm per §3.4.1 searches imported and in-scope names
in the current file; visibility filters which names can be successfully
brought into scope or referenced via path. Trait-method calls follow the
same rule, with the additional reach constraint from §10.8 — the
implementation's effective visibility is the minimum of the trait's
and type's visibility.

---

## 11. Local Mutability and Ownership

This section specifies the language's local mutability model. Mutation is
permitted only inside function bodies, scoped to bindings declared with
`mut`. Ownership of values is tracked through move semantics: every value
has exactly one owner at any moment. Read-only access to non-`Copy` values
without ownership transfer is provided through call-scoped borrows declared
in function signatures.

This section supersedes the absolute-immutability language in §1.3. The
broader principle stands — immutability is the default and external state
remains immutable — but local mutation is permitted inside function bodies
as a controlled escape hatch for performance.

### 11.1 Design Principles

Mutation in Symphony is an escape hatch, not the primary expression style.
The default remains immutability and pure functions; `mut` exists because
some computations (DSP buffer processing, in-place transformations,
algorithm internals) cannot be expressed efficiently in a pure-functional
style. The model is designed to *isolate* mutation rather than eliminate
it.

Three load-bearing rules constrain where and how mutation can occur:

**Nothing outside a function body is mutable.** Module-level bindings,
record fields as a property of the type, function parameters, enum
variants — none of these can be declared `mut`. The `mut` keyword is
legal only on bindings introduced inside a function body.

**Single ownership.** At every moment, every value has exactly one owner.
Passing a non-`Copy` value into a function transfers ownership. Returning
it transfers ownership back to (a new binding in) the caller. Assigning a
non-`Copy` value to a new binding transfers ownership. The compiler tracks
ownership at every binding site; using a value after ownership has been
transferred is a compile error.

**Single writer.** A `mut` binding is the only path through which its
underlying value may be mutated. While a borrow of the value is active,
even the owner cannot mutate it. The compiler enforces this without any
runtime check.

The result is a model where mutation is locally efficient (no copying for
in-place updates) but globally invisible (no caller can observe a callee's
mutations except through the callee's declared return value). This
combination preserves the language's pure-functional surface (functions
remain referentially transparent observably) while permitting imperative
implementation underneath.

### 11.2 Binding Forms: `let` and `mut`

The language has two binding forms for runtime values:

```
let x = expr        // immutable binding
mut x = expr        // mutable binding (function bodies only)
```

`let` is the general-purpose binding form, identical to the form specified
in §2.1.2 and §2.4.1.1. The binding is immutable: the binding name cannot
be reassigned, the bound value cannot be mutated through this binding, and
field/element assignment through this binding is a compile error.

`mut` is the local-mutability binding form. The binding name can be
reassigned, the bound value can be mutated in place (through indexed
assignment, field assignment, or whole-value reassignment), and the
binding lives only within the function body where it is declared.

`mut` is **forbidden at module top level**, **forbidden inside type, trait,
node, and connection bodies**, and **forbidden on function parameters**.
Only function bodies (and nested block scopes within function bodies) may
contain `mut` declarations. The grammar and the type checker both enforce
this; a `mut` declaration outside a function body is a compile error at
the declaration site.

The `const` binding form (§2.4.1.1) remains valid as the strictly
compile-time-only form. `const` and `mut` are mutually exclusive — `const`
asserts compile-time-only and immutable; `mut` is necessarily runtime and
mutable.

#### 11.2.1 Shadowing

Either form may shadow a previously declared binding in the same scope:

```
fn process(input: Vec[i32]) -> i32:
  let input = preprocess(input)       // shadows the parameter
  let input = filter(input)           // shadows again
  sum(input)
```

Shadowing creates a new binding with the same name; the prior binding is
no longer accessible by that name from the shadow point forward. Under
move semantics this is the idiomatic pattern for "thread a value through
a pipeline" — each step rebinds the same name to the new owned value.

A `let` may shadow a `mut` and vice versa. The new binding's mutability is
governed solely by its own declaration form, not by what it shadowed.

### 11.3 Ownership and Move Semantics

Every value has exactly one owner. The owner is the binding (or temporary
expression slot) that currently holds the value. Ownership transfers in
three situations:

- **Assignment.** `let y = x` or `mut y = x` transfers ownership of `x`'s
  value to `y`. After this point, `x` is no longer accessible by that name.
- **Function argument passing.** `f(x)` transfers ownership of `x` into the
  function's parameter binding for the duration of the call. After the
  call, `x` is consumed; the caller's binding is no longer usable.
- **Function return.** `return e` transfers ownership of `e`'s value out
  of the function and into whatever binding (or expression) receives the
  return value at the call site.

Ownership transfer is what "move" means. The compiler tracks ownership
statically; using a binding after its value has been moved is a compile
error reported at the use site, with the location of the move identified.

```
let v = make_buffer()       // v owns the buffer
let w = v                   // ownership moved from v to w; v no longer usable
print(v)                    // ✗ compile error: v consumed at line 2
```

#### 11.3.1 Reading versus consuming

The owner of a value may *read* through it without consuming it. Reading
includes:

- Field access: `r.field`
- Indexed access: `arr[i]`
- Pattern matching with read-only patterns
- Built-in operator inspection (`is`, `<`, etc.)

Reading does not transfer ownership. The owner retains the value after
the read.

```
let r = make_record()
print(r.first_name)         // reads r.first_name; r still owned
print(r.last_name)          // reads again; r still owned
consume(r)                  // consumes r; ownership moved
print(r.age)                // ✗ compile error: r consumed at line 4
```

Consuming includes:

- Function argument passing (by-value parameters): `f(r)`
- Return statements: `return r`
- Assignment to a new binding: `let x = r`
- Storing in a record field, tuple component, or enum payload

These operations transfer ownership.

#### 11.3.2 Reassignment of `mut` bindings

A `mut` binding may be reassigned. Reassignment consumes the new value
and drops the old value:

```
mut buf = make_buffer()
buf = make_other_buffer()    // old buffer dropped, new one bound
```

Reassignment is *not* shadowing — it modifies the existing binding rather
than introducing a new one. The binding remains the same; only the value
it holds changes.

#### 11.3.3 Dropping

When a binding goes out of scope, its value is dropped. For `Copy` types,
dropping is a no-op. For non-`Copy` types whose constituent resources
require cleanup (heap allocations, file handles via stdlib, etc.), the
type's drop behavior is invoked.

Drop semantics for user-defined types are specified through the trait
system; the precise mechanism is deferred to §Drop Trait (deferred).

### 11.4 The `Copy` Trait

`Copy` is a marker trait. A type's values may be duplicated by the
language at every use site (assignment, argument passing, return) without
transferring ownership. The original binding remains usable.

```
trait Copy
```

No methods. No associated types. The trait's only purpose is to flag a
type as having implicit-duplication semantics.

#### 11.4.1 Auto-implementations

The following types automatically implement `Copy`:

- All primitive numeric types (`i8`–`i128`, `u8`–`u128`, `isize`, `usize`,
  `f32`, `f64`).
- `bool`, `char`.
- `string` (see §11.6).
- Tuples whose components are all `Copy`.

#### 11.4.2 Opt-in via `@derive(Copy)`

A record may opt into `Copy` semantics by including `@derive(Copy)` in its
declaration:

```
@derive(Copy)
type Color:
  r: u8
  g: u8
  b: u8

@derive(Copy, Eq, Hash)
type Vec3:
  x: f32
  y: f32
  z: f32
```

`@derive(Copy)` requires every field's type to itself be `Copy`. If any
field is non-`Copy` (e.g., contains an array or a non-`Copy` user type),
the derivation fails with a compile error identifying the offending field.

A newtype may opt into `Copy` similarly; the wrapped type must be `Copy`.

#### 11.4.3 Semantics of `Copy` use sites

For `Copy` types, every operation that would normally transfer ownership
instead produces an independent value:

```
@derive(Copy)
type Point:
  x: f32
  y: f32

let p = Point(x: 1.0, y: 2.0)
let q = p                         // q is an independent Point; p still usable
let total_x = p.x + q.x           // both readable
plot(p)                            // does not consume p
plot(q)                            // does not consume q
print(p.x)                         // ✓ p still owned
```

The duplication is conceptually a value-by-value copy. The runtime cost
is whatever the type's representation makes it (a register copy for small
types, a memcpy for larger ones). The language guarantees the user-visible
behavior; the compiler picks the implementation.

#### 11.4.4 `Copy` and `mut`

A `mut` binding to a `Copy` type behaves the same as for non-`Copy` types
with respect to mutation — the binding's value can be reassigned and (for
record/tuple `Copy` types) fields can be assigned. Other (immutable)
bindings to copies of the same value are unaffected by mutations made
through one `mut` binding, because they hold independent copies.

```
@derive(Copy)
type Counter:
  value: i32

let original = Counter(value: 0)
mut working = original              // independent copy
working.value = 5                   // mutates working's copy
print(original.value)               // 0; original unchanged
print(working.value)                // 5
```

This is the standard interpretation of value-type mutation in
copy-semantic languages.

### 11.5 The `Clone` Trait

`Clone` is the trait for explicit deep duplication:

```
trait Clone:
  fn clone(value: &Self) -> Self
```

The method takes a borrow (§11.9) of the source value and returns an
independent owned copy.

Where `Copy` produces implicit duplications with no syntactic marker,
`Clone` requires an explicit `.clone()` call at every duplication site.
The visible call signals that an allocation (or analogous resource
duplication) may be occurring.

#### 11.5.1 Auto-derivation

`Clone` is one of the derivable traits per §3.8:

```
@derive(Clone)
type Buffer:
  data: f32[1024]
  sample_rate: i32
```

For records, derived `Clone` clones each field. Every field's type must
itself be `Clone`. For enums, derived `Clone` clones the payload of the
active variant.

#### 11.5.2 Relationship to `Copy`

`Copy` types are trivially `Clone` — the implicit duplication mechanism
provides a `.clone()` method that returns the same result as direct use.
The compiler auto-derives `Clone` for every `Copy` type.

The converse is not true: most `Clone` types are not `Copy`. Heap-allocated
structures (`Vec`, `HashMap`), arrays, and records containing them are
`Clone` (when their fields support it) but not `Copy`.

#### 11.5.3 Usage

`Clone` is invoked when the user needs two owned copies of a non-`Copy`
value:

```
let buf = make_buffer()
let backup = buf.clone()          // explicit deep copy
process(buf)                       // buf consumed
restore(backup)                    // backup still owned
```

The clone allocates as the type requires. Users who write `.clone()` are
making the cost visible.

### 11.6 Strings and the `Copy` Implementation

`string` is a `Copy` type despite being heap-allocated. Per §9.1, strings
are UTF-8 encoded sequences and are immutable. The implementation realizes
`Copy` semantics through refcounted shared backing: assigning, passing, or
returning a `string` increments a refcount on the underlying byte storage
without copying bytes; dropping a `string` decrements the refcount and
deallocates when it reaches zero.

This is observable to the user only through:

- Performance: `let t = s` is constant-time regardless of string length.
- Mutation: irrelevant, since `string` is immutable; the refcount-shared
  backing is never visible because nothing can write through it.

The user-visible model is simply: `string` is `Copy`. Passing strings to
functions does not consume them; using a string in multiple places does
not require `.clone()`.

#### 11.6.1 Why arrays are different

Arrays (§9.3) are not `Copy`, regardless of element type or compile-time
size. Implicit duplication of arrays would either require deep copy
(silent allocation per `let t = arr`, defeating the language's
performance goals) or refcounted shared backing (which is unsafe for
arrays because `mut` bindings to arrays support in-place mutation —
sharing the backing would let one binding see another's writes,
violating single-writer).

Strings escape this trade-off by being immutable. There is no `mut`
operation on a string that mutates its bytes; every "modification" returns
a new string. Refcount-shared immutable backing is therefore safe. For
arrays, no such immutability exists, so shared backing is unsafe.

The user-visible rule: strings are `Copy`, arrays are not. The
implementation difference is the immutability constraint.

### 11.7 Function Parameters

A function parameter declares either *by-value* ownership transfer or
*by-borrow* read-only access. The declaration uses the parameter's type
position:

```
fn consume_buffer(b: Vec[f32]) -> Vec[f32]: ...      // by-value: takes ownership
fn inspect_buffer(b: &Vec[f32]) -> isize: ...        // by-borrow: read-only access
```

The `&` prefix on the parameter's type denotes a borrow. Without the
prefix, the parameter is by-value.

#### 11.7.1 By-value parameters

A by-value parameter receives ownership of its argument. For `Copy`
argument types, this is equivalent to making an independent copy and
binding it to the parameter — the caller's binding remains usable. For
non-`Copy` types, the caller's binding is consumed; using it after the
call is a compile error.

The function body owns the parameter for the duration of the call. It
may read the parameter, pass it to other functions (transferring ownership
further), return it, or let it drop at function exit.

A by-value parameter is itself an immutable binding inside the function
body — like a `let` binding. To mutate it, the body must rebind it to a
local `mut` binding (§11.7.3).

#### 11.7.2 No `mut` on parameters

A function parameter may not be declared `mut`:

```
fn process(mut buf: Vec[f32]) -> Vec[f32]: ...    // ✗ compile error
```

The forbid is intentional. A function's signature is its contract with
callers; that contract specifies type and ownership behavior. Mutation is
the function's internal implementation choice — invisible to callers
because the caller's binding has already been consumed (for non-`Copy`
parameters) or never affected (for `Copy` parameters). Exposing mutation
in the signature creates ambiguity about whether the function is pure
without changing what the function can actually do.

A function that intends to mutate its parameter rebinds it to a local
`mut`:

```
fn apply_gain(buf: Vec[f32], gain: f32) -> Vec[f32]:
  mut local = buf
  // mutate local in place
  local
```

The rebind is one line per function and surfaces the moment where the
received parameter transitions to mutable working state.

#### 11.7.3 Local rebinding to `mut`

The rebind pattern `mut local = parameter` moves the parameter's value
into a fresh `mut` binding. After the rebind, `local` is mutable and
`parameter` (now consumed) is no longer accessible.

For `Copy` parameter types, the rebind produces an independent mutable
copy; mutations to `local` are invisible to the (also-still-usable)
parameter binding. For non-`Copy`, the parameter binding is consumed by
the move into `local`.

```
fn double_in_place(arr: i32[16]) -> i32[16]:
  mut local = arr               // arr consumed; local owns the array
  // mutate local[i] for each i
  local
```

#### 11.7.4 By-borrow parameters

A by-borrow parameter (`&T`) is a read-only handle to the caller's value
for the duration of the call. The caller retains ownership; the function
body may inspect the borrowed value but may not mutate it, consume it,
return it, or store it anywhere persistent.

By-borrow parameters allow inspection of non-`Copy` values without
forcing ownership transfer. The dominant use case is stdlib container
inspection: `length`, `contains`, `is_empty`, comparison, hashing, and
similar operations declare `&T` parameters and leave callers' bindings
untouched.

Full borrow semantics are specified in §11.9.

### 11.8 Call-Site Semantics

The caller writes a uniform call syntax regardless of whether the function
consumes or borrows its parameters:

```
let v = make_buffer()
let n = length(v)             // length declares &Vec; v survives the call
let v = push(v, 42)           // push declares Vec; v consumed, return rebinds
let m = length(v)             // length again; v still owned
```

The call-site syntax does not distinguish consume from borrow. The
function's signature is the authoritative contract: callers consult the
signature (directly or via tooling) to know what happens to their
arguments.

#### 11.8.1 Implicit borrow at call sites

When a function declares an `&T` parameter, the caller passes the binding
without any sigil — `length(v)` rather than `length(&v)`. The compiler
inserts the borrow operation automatically. The borrow is active for the
duration of the call expression.

This is intentional. Borrowing is a safe operation (read-only, no aliasing
hazards), so making it explicit at call sites would add visual noise
without informational value. Adding a sigil for the *dangerous* operation
— consumption — would similarly be noise: consumption is so common under
move semantics that requiring a marker would clutter most call sites.
Instead, the language treats both behaviors as signature-driven and lets
the compiler enforce correctness through use-after-move errors.

#### 11.8.2 Use-after-move

Using a binding after its value has been consumed is a compile error,
reported at the use site. The diagnostic identifies the call (or other
operation) that consumed the binding:

```
let v = make_vec()
let n = consume_fn(v)         // v consumed here
print(v)                       // ✗ compile error:
                               //   `v` was consumed by `consume_fn` at line 2
                               //   and is no longer accessible
```

The error is local: the compiler does not need to analyze the function's
implementation; the signature is sufficient.

#### 11.8.3 Method-call form

The method-call form `x.f(args)` is sugar for `f(x, args)` per §3.4's
uniform call syntax. The same ownership rules apply: if `f` declares its
first parameter as `&T`, the call borrows `x`; if as `T`, the call
consumes `x`.

```
let v = make_buffer()
let n = v.length()           // sugar for length(v); borrows v per signature
let m = v.length()           // borrows again; v still owned
let v = v.push(42)           // sugar for push(v, 42); consumes; rebind
```

Field access `x.field` and indexed access `x[i]` are not function calls
and do not consume regardless of any signature. They are language
primitives that read without ownership transfer.

#### 11.8.4 Refactoring impact

Changing a function's parameter from `T` to `&T` (consume to borrow) is a
*loosening* of the contract. Existing callers continue to compile:
arguments that were being consumed are now merely borrowed; the caller
retains access to the binding afterward (which is strictly more
permissive than the previous behavior).

Changing a parameter from `&T` to `T` (borrow to consume) is a
*tightening* of the contract. Callers that were using the argument after
the call now see use-after-move errors at those use sites. The errors are
local and clearly indicate which call consumed the value.

In neither direction is the refactor silent: tightening produces clear
compile errors at the affected sites; loosening produces no errors at all.

### 11.9 The Borrow Form (`&T`)

A borrow is a temporary, read-only handle to a value, scoped to a single
function call expression. Borrows are declared in function-parameter type
position with the `&` prefix:

```
fn length(v: &Vec[i32]) -> isize: ...
fn equals(a: &Vec[i32], b: &Vec[i32]) -> bool: ...
fn copy_into(src: &Vec[i32], dest: Vec[i32]) -> Vec[i32]: ...
```

The `&` is a parameter-position-only syntactic form. It does not appear at
call sites (per §11.8.1), in `let` or `mut` declarations, in record field
declarations, in return types, in trait bounds, or in any other position.
The borrow is created implicitly by the call dispatch when the function
declares a borrow parameter; the borrow is released when the call
expression finishes evaluating.

#### 11.9.1 Restrictions

A borrow may not be:

- **Stored in a binding.** `let r = ...` cannot bind a borrow. The
  language has no way to write down a "binding that holds a borrow"; the
  `&` form is not valid in `let`/`mut` declarations.
- **Returned from a function.** A function's return type is always an
  owned value or a `Copy` value, never a borrow. The `&` form does not
  appear in return-type position.
- **Stored in a record field, enum variant payload, or tuple component.**
  Compound types contain owned values, never borrows.
- **Captured by a closure.** Closures capture by value (§11.10); borrows
  are not values that can be captured.

These restrictions collectively ensure that a borrow never outlives the
function call expression that created it. The compiler does not need to
track lifetimes across statements, across function boundaries, or across
data structures — the borrow exists only within one call expression and
is gone by the next statement.

#### 11.9.2 Constraints during an active borrow

While a borrow of value `v` is active (i.e., during the call expression
where `&v` was passed), the owner of `v` may not:

- Move `v` (pass it by value to another function, return it, assign it to
  another binding).
- Mutate `v` (reassign through a `mut` binding, perform indexed or field
  assignment).

These constraints apply within the call expression. Once the call returns,
the borrow is released and the owner may move or mutate `v` freely.

In practice, this restriction is invisible because expressions are
evaluated sequentially. The case it forbids is multi-argument calls where
one argument borrows and another consumes:

```
let v = make_vec()
let result = combine(&v, consume_fn(v))   // ✗ compile error:
                                           //   v borrowed and moved in the same expression
```

The compiler tracks within-expression borrow activity and reports
conflicts at the offending sub-expression.

#### 11.9.3 Multiple simultaneous borrows

Multiple borrows of the same value in the same expression are permitted,
because all borrows are read-only:

```
let v = make_vec()
let r = compare(&v, &v)              // ✓ two borrows of v, both read-only
let s = max3(&a, &a, &b)             // ✓ multiple borrows of a, one of b
```

No aliasing-with-mutation hazard arises: nothing in the call expression
can mutate any of the borrowed values, by §11.9.2.

#### 11.9.4 Implicit reborrow inside function bodies

A function whose parameter is `&T` may pass that parameter to another
function expecting `&T` without any additional syntax:

```
fn length(v: &Vec[i32]) -> isize:
  count_elements(v)           // count_elements declares &Vec; reborrow is automatic

fn count_elements(v: &Vec[i32]) -> isize: ...
```

The body of `length` treats `v` as a value of type `Vec[i32]` for purposes
of reading; passing it to `count_elements` extends the borrow chain. The
compiler tracks that `v` inside `length` is a borrow (not an owned value)
and forbids operations that would consume or store it:

```
fn length(v: &Vec[i32]) -> isize:
  count_elements(v)           // ✓ reborrow
  consume_vec(v)              // ✗ consume_vec declares Vec by value;
                              //   cannot move out of borrowed v
  return v                    // ✗ cannot return a borrow as owned
  let saved = v               // ✗ cannot bind a borrow
```

#### 11.9.5 Where borrows may appear

`&T` is grammatically valid only in *parameter positions*. The language
recognizes three positions, each with a clear, lexically-bounded borrow
lifetime:

- **Function parameter type signatures** (this section, §11.7.4 and
  §11.9). A `&T` in a parameter signature declares that the function
  borrows that argument for the duration of the call expression.
- **For-loop iteration variables** (§12.3.3). The iteration variable is
  bound by the loop construct, fresh each iteration, immutable, and
  cannot be declared `mut`. When the iterator's `Item` type is a borrow
  type, the iteration variable is borrow-shaped for the duration of one
  iteration body.
- **For-loop iteration source expression** (§12.3.1). The expression
  between `for x in` and `:` may be a borrow expression `&v`, which
  invokes borrowing iteration via the `Iterable` trait (§12.8). The
  borrow lives for the duration of the entire for-loop expression. This
  is the only position where `&v` is an *expression* rather than a
  signature element; everywhere else, `&v` as an expression is a parse
  error.

All three positions share the same lifetime discipline: the borrow lives
for the scope of one parameter-binding occurrence (one call expression,
one iteration body, or one for-loop expression respectively). The
compiler does not need lifetime parameters or cross-statement tracking;
the lifetime is determined syntactically by the enclosing position.

Outside these positions, `&T` is a parse error.

**As a type expression** (`&T` in a type-annotation position), it is
forbidden in:

- `let` and `mut` declarations: `let r: &Vec = ...` is a parse error.
- Record fields: `type Holder: data: &Vec` is a parse error.
- Enum payloads: `Variant(&T)` is a parse error.
- Tuple components, *except* the tuple appearing as the return type of
  `Iterator::next` per §12.7.4: `(&i32, i32)` is generally a parse error.
- Function return types, *except* `Iterator::next` per §12.7.4:
  `fn f(...) -> &T` is generally a parse error.
- Closure parameter types in stored closure types (deferred).
- Trait associated types, *except* `Iterator::Item` per §12.7.4:
  `type Item = &T` is generally a parse error.
- Generic-type arguments, *except* in `Option[&T]` as it appears in
  `Iterator::next`'s return per §12.7.4: `Vec[&i32]` is a parse error.

**As a value expression** (`&v` evaluating to a borrow of `v`), it is
forbidden everywhere *except* in the for-loop iteration source position
(§12.3.1):

- Function argument expressions: `f(&v)` is a parse error. Function-call
  argument syntax does not include `&`; the function's signature
  determines whether the argument is consumed or borrowed (§11.8.1).
- Binding right-hand sides: `let r = &v` is a parse error.
- Return expressions: `return &v` is a parse error.
- Record/tuple/enum construction: `Holder(field: &v)` is a parse error.
- Closure capture expressions: borrows cannot be captured.

The narrow exceptions for the `Iterator` trait (above) and for the
iteration source expression position (§12.3.1) exist because both flow
directly into the for-loop iteration variable position; the borrow's
lifetime is bounded by the iteration body or the for-loop expression in
exactly the same way function-parameter borrows are bounded by the call
expression. The exceptions are bounded; they do not generalize to
arbitrary user code.

This restriction keeps the borrow model trivially sound without lifetime
parameters or cross-statement tracking.

#### 11.9.6 Borrows of `Copy` values

A `Copy` value may also be passed by borrow rather than by value if the
function declares `&T`. The behavior is identical in effect — neither
form consumes the caller's binding — and the choice is the function
author's. Borrow declarations on `Copy` types are unusual but legal; the
caller cannot tell the difference at the call site.

The motivation for declaring `&T` even when `T` is `Copy` is uniform API
shape: a function generic over `T: SomeTrait` may want to take `&T` so
the behavior is consistent across `Copy` and non-`Copy` instantiations.

### 11.10 Closures and Capture

A closure is an anonymous function that may capture values from its
enclosing scope. Symphony's closures capture *by value*: each captured
value is stored inside the closure at the moment of definition.

#### 11.10.1 Captures must be `Copy`

Every value captured by a closure must have a `Copy` type. The captured
value is a snapshot of the source value at definition time; the closure
holds an independent copy.

```
let gain: f32 = 1.5
let process = |sample: f32| sample * gain    // captures gain (f32, Copy) ✓
```

For non-`Copy` source values, capture is a compile error:

```
let buf = make_buffer()                       // Vec[f32], non-Copy
let closure = || sum(buf)                     // ✗ compile error:
                                              //   cannot capture non-Copy value `buf`
```

Non-`Copy` values flow through closures as arguments rather than captures:

```
let closure = |b: &Vec[f32]| sum(b)          // takes a borrow argument
let total = closure(&buf)                     // caller passes &buf each call
```

#### 11.10.2 Capture granularity

The compiler captures the minimal set of subvalues the closure body
references. For a body that reads a single field of a larger record, only
that field is captured — provided the field's type is `Copy`:

```
let contact = Contact(first_name: "Alice", age: 30, ...)
let closure = || contact.age + 1              // captures contact.age (i32, Copy)
                                              // contact stays in outer scope, fully usable
```

If a captured subvalue's type is not `Copy`, the capture fails regardless
of whether the root binding is `Copy`. The constraint applies to the
captured value's type, not the root binding's type.

#### 11.10.3 Captures from `let` only

Closures may capture from `let` bindings. They may not capture from `mut`
bindings:

```
let stable = 5
let closure_a = || stable + 1                 // ✓ capture from let

mut counter = 0
let closure_b = || counter + 1                // ✗ compile error:
                                              //   cannot capture from `mut` binding `counter`
```

The forbid prevents a footgun: closures capture by value at definition
time (a snapshot), but users naming a `mut` binding might intuitively
expect the closure to see live updates. Forbidding the capture forces the
user to make the snapshot explicit:

```
mut counter = 0
counter = compute_initial()
let snapshot = counter                        // explicit snapshot via let
let closure = || snapshot + 1                 // captures snapshot (Copy)
counter = counter + 1                         // mut continues to evolve
                                              // closure still sees the snapshot value
```

For closures that must track live updates of changing state, the reactive
system is the appropriate mechanism. The reactive system is specified in
a deferred section.

#### 11.10.4 Body unrestricted

Within a closure body, all the usual function-body rules apply. The body
may declare local `mut` bindings, call functions (consuming arguments as
their signatures dictate), construct new values, perform iteration
(once specified), and so on. The capture-must-be-`Copy` restriction
applies only to the closure's captured environment, not to anything the
body does internally.

```
let scale: f32 = 2.0                          // Copy capture
let process = |raw: Vec[f32]| -> Vec[f32]:
  mut local = raw                              // mut local; allowed inside closure body
  apply_scale_in_place(local, scale)           // internal work; captures untouched
  local
```

#### 11.10.5 Borrows cannot be captured

A borrow is not a value (per §11.9). Closures capture values; therefore
closures cannot capture borrows. There is no `&T` form usable in a
capture context.

A closure body may receive borrows as *arguments* (its parameter list may
include `&T` parameters), but it cannot retain borrows from outside its
parameter list.

### 11.11 Indexed and Field Assignment

Assignment through a `mut` binding to a field or array element is
permitted:

```
mut r = make_record()
r.field = new_value          // ✓ field assignment

mut arr = make_array()
arr[5] = 1.5                  // ✓ indexed assignment
```

The root binding (`r`, `arr`) must be declared `mut`. The field or
element being assigned must itself be of a type compatible with the
assigned value, per the standard type-check rules.

Field and indexed assignment desugar to operator-trait method calls (the
exact traits — `FieldAssign`, `IndexAssign`, or analogous — are specified
in §Operator Traits, deferred). The desugaring preserves the
single-writer invariant: the assignment is a mutation through the `mut`
binding only; no other binding to the same underlying value can exist
while the mutation occurs (borrows would block it per §11.9.2; aliased
ownership is impossible by construction).

Reading a field or element from any binding (whether `let` or `mut`) is
unrestricted (§11.3.1).

#### 11.11.1 Whole-value reassignment

A `mut` binding may be reassigned entirely:

```
mut buf = make_buffer()
buf = make_other_buffer()    // replaces the buffer; old one dropped
```

This drops the previous value and binds the new value. The new value is
moved into the binding (consumed from its source).

### 11.12 Interaction with Records, Enums, and Newtypes

The compound types of §6 interact with mutability as follows:

- A record, enum, or newtype may itself be `Copy` if it carries
  `@derive(Copy)` and all its fields/payloads are `Copy`.
- Mutability is purely a property of the binding (per §11.2), not of the
  type. A type does not declare "this is mutable"; specific bindings to
  values of the type may be declared `mut`.
- A record's fields, an enum variant's payload, and a newtype's wrapped
  value may all be assigned through a `mut` binding to the containing
  value, provided the field/payload/wrapped type permits assignment.

Records (§6.1) explicitly forbid `fn` declarations in their bodies; this
forbid does not extend to disallowing `mut` interaction. A function
elsewhere that holds a `mut` binding to a record may freely assign its
fields.

#### 11.12.1 Smart constructors and `mut`

The `public(private)` constructor pattern (§6.1.7, §6.3.4) restricts
construction to the type's defining module. This restriction interacts
naturally with `mut`: any code holding a `mut` binding to such a type can
still mutate its fields (subject to field visibility per §10.7); the
restriction is only on initial construction, not on subsequent mutation.

For types where post-construction mutation should also be restricted, the
appropriate mechanism is field-level visibility (`private field_name:
T`), which prevents external code from naming the field in an assignment
expression.

### 11.13 Interaction with the Trait System

Trait method signatures may declare borrow parameters identically to free
functions:

```
trait Length:
  fn length(value: &Self) -> isize

fulfill Length for Vec[i32]:
  fn length(value: &Vec[i32]) -> isize:
    ...
```

The `&Self` in the trait declaration becomes `&Vec[i32]` (or whatever the
implementing type is) in each `fulfill` block, by the standard `Self`
substitution rule of §3.1.1.

Trait dispatch (§3.4) is unaffected by ownership semantics. Whether a
trait method consumes or borrows its receiver depends on the trait
method's signature; callers write the same uniform-call syntax regardless.

Trait objects (§5.2, `dyn T`) may invoke methods that declare `&T`
parameters. The borrow lifetime remains call-scoped as for direct calls.

### 11.14 Interaction with Reactivity

The reactive system is specified in a deferred section. The interaction
with local mutability follows two principles, recorded here for
forward-compatibility:

- **Reactive expressions (`derived` and analogous) are pure-evaluated.**
  A `derived` expression's body runs as a pure function of its inputs
  each time inputs change. The body may invoke ordinary functions that
  use `mut` internally; the body itself produces a value that enters the
  reactive graph.

- **Values entering the reactive graph become external state.** Once a
  value is bound into the reactive system as a signal, derived, or
  reactive store, it is no longer the property of any single function's
  scope. External state is immutable per §11.1's "nothing outside a
  function body is mutable" principle; reactive values are updated only
  through the reactive system's defined update mechanisms, never through
  `mut` assignment.

The reactive boundary is one of the "global" scopes referenced in
§11.1's principles. The full specification of how values cross this
boundary is deferred to the reactive-system section.

---

*End of §11.*

---

## 12. Iteration and Loops

This section specifies the language's iteration constructs: integer ranges,
the `for`-loop (in both consuming and borrowing forms), the `while`-loop,
the `break` and `continue` statements, loop expression semantics with the
`else:` clause, and the `Iterator`, `Iterable`, and `IntoIterable` traits
that underlie all iteration.

Loops are the necessary complement to local mutability (§11): without
bounded iteration, indexed buffer construction and accumulation patterns
require recursion, which is unusable for the workloads (audio DSP, image
processing, numerical kernels) that motivate the local mutability model.
This section completes the imperative-control story for performance-
sensitive code while keeping the rest of the language pure and functional.

### 12.1 Design Principles

Loops in Symphony follow three guiding rules:

**Iteration is trait-driven.** A `for` loop dispatches through the
`IntoIterable` trait (consume form, default) or the `Iterable` trait
(borrow form, explicit `&v`) to obtain an `Iterator`, then dispatches
through the `Iterator` trait to produce successive values. There is no
built-in iteration logic specific to particular types; all iteration
goes through the trait protocol. Users may extend iteration to their
own types by implementing either or both traits.

**Loops are expressions.** Both `for` and `while` produce values. The
value is determined by the body's `break` statements and an optional
`else:` clause (§12.6). Loops that are not used in an expression context
produce unit; loops that are used in an expression context obey the
value-shaping rules of §12.6.

**Mutation discipline is preserved.** Loop bodies are ordinary function
body fragments. They can mutate `mut` bindings declared inside or outside
the loop, perform indexed and field assignment through `mut` bindings,
and call functions per the ownership rules of §11. Under the borrow
form, the borrow checking rules of §11.9 apply: while a collection is
being iterated, the collection is borrowed and may not be moved or
mutated through its owner. Under the consume form, the collection is
consumed at loop entry and no longer accessible to the surrounding scope.

### 12.2 Ranges

A *range* is a value representing a sequence of integers. The range
expression syntax is `start..end`, where `start` and `end` are integer
expressions:

```
0..10                          // integers 0, 1, 2, ..., 9
1..100                         // integers 1, 2, ..., 99
n..(n + size)                  // dependent on n and size
```

Ranges are half-open and exclusive on the upper bound: `start..end`
contains integers `i` such that `start <= i < end`. To iterate up to
and including some value `N`, write `start..(N + 1)`. There is no
inclusive-range form (`..=`) in v1.

Ranges are values of type `Range[T]`, where `T` is the integer type of
`start` and `end` (the two operands must have the same integer type;
mixed-kind operands require explicit conversion). Ranges may be bound,
passed to functions, returned, and used like any other value:

```
let r = 0..1024              // r: Range[i32], by default integer placeholder
fn process_range(r: Range[i32]) -> isize: ...
```

`Range[T]` implements both `IntoIterable` (§12.9) and `Iterable`
(§12.8). The consume form `for i in 0..N` dispatches through
`IntoIterable`; the borrow form `for i in &(0..N)` dispatches through
`Iterable`. Since `Range[T]` is `Copy`, the two forms are functionally
indistinguishable from the user's perspective — there is nothing to
preserve on the source side either way. The implementations yield
successive integers starting from `start` and stopping before `end`.
If `start >= end`, the range is empty and yields no values.

#### 12.2.1 Step

The v1 range syntax has no step parameter. Iteration always advances by
one. To iterate with a different stride, the user writes the arithmetic
explicitly:

```
for i in 0..(N / 2):
  let actual_i = i * 2          // 0, 2, 4, ..., N-2
  process(actual_i)
```

A step-aware range form may be added in a future version of the language;
for v1, the explicit form is the supported pattern.

#### 12.2.2 Range bounds and overflow

A range's bounds are evaluated once at the point the range value is
constructed. Subsequent mutation of any variable used in those expressions
does not affect the range:

```
mut n = 10
let r = 0..n
n = 100
for i in r:                   // iterates 0..10, not 0..100
  ...
```

The bound expressions must produce integer values. Per §4.6.1, overflow
in the bound expressions traps at construction.

#### 12.2.3 Negative ranges and empty ranges

A range whose `start >= end` is empty. `for i in 5..3:` produces no
iterations and (in expression context) goes directly to the `else:`
clause if present, or produces the natural-completion value per §12.6
otherwise.

Ranges with negative starts and ends work normally if `T` is signed:

```
for i in -10..10:             // i: i32 (default); -10, -9, ..., 9
  ...
```

For unsigned `T`, negative literals are rejected at the value-fits-check
per §2.4.3.

### 12.3 The `for` Loop

The `for` loop iterates over the values produced by an iteration source.
The source can be passed in two forms, which select between consuming
and borrowing iteration:

```
for x in iterable:           // consumes iterable (default)
  body

for x in &iterable:          // borrows iterable
  body
```

Consume-form `for x in v` is the default because ownership transfer is
the language's default for any value passed into a sub-scope (parallel
to function calls per §11.7). Borrow-form `for x in &v` explicitly opts
out of ownership transfer when the source must remain usable after the
loop. This matches the parameter rule (`fn f(x: T)` consumes, `fn f(x:
&T)` borrows) but operates on the loop expression rather than a function
signature.

#### 12.3.1 Evaluation

The iteration source expression is evaluated once at loop entry.

**Consume form** (`for x in v:`):

1. The compiler invokes `IntoIterable::consuming_iterator(v)` (§12.9).
   This consumes the binding `v`; the underlying value is moved into
   the iterator.
2. The iterator is held in an internal `mut` binding for the loop's
   duration.
3. Each iteration step calls `Iterator::next` (§12.7), receiving
   `(Option[Item], NewIter)`. Under consuming iteration, `Item` is
   always an owned type per §12.9.2.
4. The internal binding is reassigned to `NewIter`.
5. If the option is `Some(value)`, binds `value` to the iteration
   variable `x` and runs the body.
6. If `None`, the loop exits.
7. When the loop exits (natural completion, `break`, or enclosing
   function return), the iterator is dropped. Any elements not yet
   yielded are dropped per their `Drop` semantics. The original source
   binding `v` is consumed; it cannot be referenced after the loop.

**Borrow form** (`for x in &v:`):

1. The compiler evaluates `&v` as a borrow expression and invokes
   `Iterable::iterator(&v)` (§12.8). The borrow lives for the duration
   of the for-loop expression.
2. The iterator is held in an internal `mut` binding for the loop's
   duration.
3. Each iteration step calls `Iterator::next`, receiving
   `(Option[Item], NewIter)`. Under borrowing iteration, `Item` may be
   a borrow type (`&T`) per §12.7.4; the iteration variable's type
   follows from `Item`.
4. The internal binding is reassigned to `NewIter`.
5. If the option is `Some(value)`, binds `value` to the iteration
   variable `x` and runs the body.
6. If `None`, the loop exits.
7. When the loop exits, the iterator and the borrow of `v` are
   released. `v` is unchanged and remains owned by the original
   binding.

The `&v` form is the only place in the language where `&` appears as
a value expression rather than a type annotation. Its lifetime is
bounded by the for-loop expression, requiring no annotations or
cross-statement tracking (§11.9.5).

**Iteration source that is already a borrow:** when the iteration
source expression is of a borrow type (because the binding being
referenced is itself a borrow — e.g., a function parameter typed `&T`,
or an iteration variable from an outer loop typed `&T`), the for-loop
dispatches to `Iterable` directly. No explicit `&` is needed because
the value is already a borrow:

```
fn sum(samples: &Vec[f32]) -> f32:
  mut total: f32 = 0.0
  for s in samples:            // samples is already &Vec; Iterable dispatch
    total = total + s
  total
```

Writing `&samples` in this position is a compile error — `&` may only
be applied to owned values, not to expressions that already evaluate
to a borrow. (The grammar accepts `&samples` syntactically; the type
checker rejects it once it determines `samples` is of borrow type.)
The compiler dispatches based on the type of the iteration source:
owned types use `IntoIterable` (consume); borrow types use `Iterable`
(no consume possible, since borrows can't be consumed).

This means the rule "consume by default" applies to owned bindings.
For borrowed bindings, iteration is necessarily through `Iterable`
because the language cannot move out of a borrow (§11.9). Borrowed
sources iterate as if `&` were written, without requiring the user to
add it.

#### 12.3.2 The iteration variable

The iteration variable `x` is bound fresh on each iteration. It is a
`let`-style binding: immutable, with the iterated `Item` type. Reassigning
`x` within the body is a compile error.

`x` cannot be declared `mut`. The form `for mut x in iterable:` is a
parse error. This is consistent with §11.7.2's prohibition on `mut`
parameters — the iteration variable is bound by the loop construct, not
by user declaration, and follows the same rule.

If the body needs a mutable per-iteration value, it rebinds:

```
for x in 0..N:
  mut local = x
  local = local * 2
  process(local)
```

#### 12.3.3 Iteration variable type

The iteration variable's type is `Iter::Item`, where `Iter` is the
iterator type produced by the dispatch (either `IntoIterable::Iter`
under consume form, or `Iterable::Iter` under borrow form). The Item
type depends on both the iterable's element type and which form the
loop uses.

The iteration variable is one of the three valid borrow-bearing
positions per §11.9.5: bound by the loop construct, fresh each
iteration, immutable, cannot be declared `mut`. Its borrow lifetime
(when borrow-typed) is the duration of one iteration body. The compiler
tracks this without requiring lifetime annotations.

**Consume form, Copy element type** (`for sample in buf:` where `buf:
f32[1024]`): the iteration variable is an owned Copy value. The body
uses it freely.

```
let buf: f32[1024] = make_block()
mut sum: f32 = 0.0
for sample in buf:                  // sample: f32, owned (Copy)
  sum = sum + sample
// buf is consumed; cannot be used after the loop
```

**Consume form, non-Copy element type** (`for r in records:` where
`records: Vec[Record]`): the iteration variable is an owned `Record`.
Each iteration moves one record out of the consumed Vec's storage. The
body has full ownership of `r` — it can be moved into bindings, passed
to consuming functions, stored elsewhere.

```
mut destinations = make_collection()
let records: Vec[Record] = make_records()
for r in records:                   // r: Record, owned
  destinations = destinations.push(r)   // ✓ move r into destinations
// records is consumed; destinations contains the records' owned values
```

**Borrow form, Copy element type** (`for sample in &buf:` where `buf:
f32[1024]`): the iteration variable is a Copy value, identical in
behavior to the consume-form Copy case. The borrow form's only
observable difference for Copy elements is that `buf` survives the loop.

```
let buf: f32[1024] = make_block()
mut sum: f32 = 0.0
for sample in &buf:                 // sample: f32, Copy
  sum = sum + sample
process_further(buf)                // ✓ buf still owned
```

**Borrow form, non-Copy element type** (`for r in &records:` where
`records: Vec[Record]`): the iteration variable is `&Record` — a
borrow into the source's storage. The body can read fields, call
methods that take `&T`, compare, inspect, but cannot move `r` into a
binding, pass it to a consuming function, or store it past the
iteration body.

```
let records: Vec[Record] = make_records()
for r in &records:                  // r: &Record (Record is non-Copy)
  print(r.first_name)                // ✓ read access
  process_borrow(r)                  // ✓ if process_borrow takes &Record
  consume(r)                          // ✗ compile error: cannot move out of borrow
  let saved = r                       // ✗ compile error: cannot bind a borrow
// records still alive
process_further(records)
```

The borrow form's non-Copy case is what makes "iterate to inspect a
non-Copy collection" possible without paying clone cost. The iterator's
`Item` is `&Record`; the iteration variable inherits this; the borrow
is bounded by the iteration body. See §12.7.4 for how the Iterator
trait handles borrow-typed Items.

#### 12.3.4 Body scope

The body executes in a fresh nested scope each iteration. Bindings
declared inside the body are dropped at the end of each iteration. The
iteration variable `x` is in scope only within the body.

Bindings declared OUTSIDE the loop are in scope inside the body. They
persist across iterations and can be mutated if declared `mut`:

```
mut total: f32 = 0.0
for sample in samples:
  total = total + sample
print(total)                  // accumulated sum
```

This is the accumulator pattern.

#### 12.3.5 Move restrictions inside the body

Per §11, moving a value out of an outer binding inside the loop body
causes the binding to be consumed. If the loop runs more than once and
the body references that binding again, the second iteration produces a
use-after-move compile error.

```
let v = make_vec()
for i in 0..10:
  consume(v)                 // ✗ compile error: v consumed; subsequent iterations
                             //   would attempt to use already-moved v
```

The compiler detects this conservatively: any move of an outer binding
inside a loop body is reported as a potential use-after-move at the move
site, with a note explaining that the loop may execute multiple times.

To consume a value inside a loop body, the user can:

- `.clone()` the value per iteration (explicit cost).
- Restructure to consume after the loop, not inside.
- Move the value into the loop with a single-iteration loop (rare).

#### 12.3.6 Mutation of the iterated source

Under the borrow form (`for x in &v:`), the iteration source is
borrowed for the duration of the loop. Per §11.9.2, the owner may not
mutate the value through its binding while a borrow is active:

```
mut v = make_vec()
for x in &v:
  v[0] = 5                   // ✗ compile error: v is borrowed for iteration
```

This prevents iterator invalidation. The borrow ends when the loop
exits, after which the owner may freely mutate or move the value.

Under the consume form (`for x in v:`), the question doesn't arise:
`v` is consumed at loop entry; the binding doesn't exist inside the
loop body. Attempting to use `v` inside the body would be a
use-after-move error, not a borrow conflict.

### 12.4 The `while` Loop

The `while` loop repeatedly evaluates a condition and runs its body so
long as the condition is true:

```
while condition:
  body
```

#### 12.4.1 Evaluation

On each iteration:

1. The condition expression is evaluated. It must produce a value of type
   `bool`.
2. If the result is `true`, the body executes.
3. If the result is `false`, the loop exits.

The condition is re-evaluated before each iteration, including the first.
A loop whose condition is `false` at entry never executes its body.

#### 12.4.2 Idiomatic uses

The `while` loop is the right tool when the number of iterations is not
known at loop entry. Examples include polling, fixed-point computation,
state-machine progression, and consuming streaming inputs:

```
mut converged = false
mut value = initial_guess
while not converged:
  let next = update(value)
  converged = approx_equal(next, value)
  value = next

mut state = State::Initial
while state is not State::Done:
  state = step(state)
```

For "loop forever" patterns, `while true:` is the idiomatic form. There
is no separate `loop` keyword.

#### 12.4.3 Move restrictions

The same move-inside-loop rule from §12.3.5 applies. A non-`Copy` outer
binding consumed inside a `while` body produces a use-after-move error if
the loop may iterate more than once. The condition expression is also
subject to the same rule.

### 12.5 `break` and `continue`

The `break` statement exits the innermost enclosing loop. The `continue`
statement skips to the next iteration of the innermost enclosing loop.

```
for i in 0..N:
  if should_skip(i):
    continue                  // skip the rest of this iteration; go to next i
  if should_stop(i):
    break                     // exit the loop entirely
  process(i)
```

#### 12.5.1 `break` with value

In expression context (§12.6), `break` may carry a value:

```
break expr
```

The expression's value becomes the loop's expression value. The body's
`break value` sites must all produce values of compatible types, and (if
an `else:` clause is present) must agree with the else clause's type.

The plain `break` form (without value) is equivalent to `break ()` —
exiting with the unit value. A loop body that mixes `break` and
`break value` with a non-unit value is a type error.

#### 12.5.2 `continue` carries no value

`continue` does not produce a value. It is a control-flow statement only,
advancing the loop to its next iteration. The loop's expression value is
determined by `break` and `else:`, not by `continue`.

#### 12.5.3 Innermost loop only

`break` and `continue` always target the innermost enclosing loop. There
is no label syntax for targeting outer loops in v1. To exit a nested
loop construct, the user refactors to use a flag variable or extracts the
inner loop into a function that returns early.

```
fn find_in_grid(g: &Grid, target: &Cell) -> Option[(isize, isize)]:
  for row in 0..g.rows:
    for col in 0..g.cols:
      if g.get(row, col) is target:
        return Some((row, col))    // returns from the function, exiting both loops
  None
```

#### 12.5.4 `break` and `continue` outside loops

A `break` or `continue` outside a loop is a parse error.

### 12.6 Loop Expressions and the `else:` Clause

Both `for` and `while` loops produce values when used in expression
context. The value is determined by the body's `break value` sites and an
optional `else:` clause.

#### 12.6.1 The `else:` clause

A loop may have an optional `else:` clause attached to its body:

```
for i in iterable:
  body
else:
  natural_completion_value

while condition:
  body
else:
  natural_completion_value
```

The `else:` clause's expression is evaluated exactly when the loop
completes *naturally* — meaning iteration exhausts (for `for` loops) or
the condition becomes false (for `while` loops). The `else:` clause is
*not* evaluated when the loop exits via `break` or via an enclosing
function return.

The `else:` keyword is reused from `if`/`match` constructs but has
different semantics here. A reader should understand `else:` on a loop as
"otherwise, the loop completed naturally and this is the value."

#### 12.6.2 Loop expression type

The loop expression's type is determined by the combination of `break
value` sites in the body and the presence/absence of an `else:` clause:

| Body has `break value` | `else:` clause | Loop expression type |
|---|---|---|
| No | absent | `()` (unit) |
| No | present | type of `else:` expression |
| Yes | absent | `Option[T]` |
| Yes | present | `T` |

where `T` is the unified type of all `break value` sites (and the
`else:` clause, when present).

##### Without `break value`, without `else:`

The loop produces unit. This is the statement form.

```
for i in 0..N:
  process(i)
                              // expression value: () (unit)
```

##### Without `break value`, with `else:`

The loop produces the `else:` clause's value. The body never produces a
value via break, so the only path to a loop value is natural completion
through `else:`:

```
let summary = for sample in samples:
  process(sample)
else:
  count_of_samples            // always reached after natural completion
                              // expression value: count_of_samples
```

This form is unusual but consistent. It is most useful when the body has
significant side effects (mutations, function calls) and the user wants
the loop to also yield a summary value.

##### With `break value`, without `else:`

The loop produces `Option[T]`. `Some(v)` from `break value`, `None`
from natural completion:

```
let found = for item in &items:
  if matches(item):
    break Some(item.id)       // borrow form: items survives the loop
                              // expression value: Option[ItemId]
```

For the find-first pattern, the user typically wants `Some(item)` from
the break and `None` from natural completion (no match). With this
shape, the loop's expression type is `Option[Item]`, and the user
match-decides on the result.

##### With `break value`, with `else:`

The loop produces `T`. The `break value` sites and the `else:` clause
all produce values of the same type:

```
let answer = for n in &numbers:
  if is_special(n):
    break n
else:
  -1                          // fallback when no n is special
                              // expression value: i32 (n is Copy)
```

This form is typical when the user wants a guaranteed value without
unwrapping an Option.

#### 12.6.3 Type unification

All `break value` expressions in a single loop body must produce values of
the same type (or be unifiable). When an `else:` clause is present, its
expression must produce a value of the same type. If types cannot be
unified, the compiler reports a type error at the conflicting break or
else site.

```
for i in 0..N:
  if cond_a: break 42
  if cond_b: break "hello"      // ✗ type error: i32 vs string
else:
  ...
```

#### 12.6.4 The `never` type and unreachable completions

If the body provably never completes naturally — for instance, every
path through the body produces a `break value`, or terminates via
`return`, `panic`, or other diverging operation — the natural-completion
case is unreachable. The compiler may use the `never` type (§8.2.2) to
unify the unreachable case with any other type.

```
let value = for i in 0..N:
  if condition(i):
    break i
  else:
    panic("unexpected")        // diverges; never type
                                // expression value: i32 (from break)
                                // no else: clause needed; natural completion unreachable
```

#### 12.6.5 `continue` and the expression value

`continue` does not contribute to the loop's expression value. It advances
to the next iteration without producing a value. The loop's value is
determined by `break value` and `else:` only.

### 12.7 The `Iterator` Trait

`Iterator` is the stdlib trait for types that produce a sequence of values
on demand:

```
trait Iterator:
  type Item
  fn next(iter: Self) -> (Option[Item], Self)
```

The `next` method takes the iterator by value, advances its internal
state, and returns both the next item (or `None` if the iteration is
complete) and the advanced iterator. The caller binds the returned
iterator for the next call.

#### 12.7.1 Why the tuple return

The trait method returns `(Option[Item], Self)` because the iterator's
internal cursor state must be mutated across calls, but the language has
no `&mut` parameter form (§11.9) and forbids `mut` on parameters
(§11.7.2). Under these constraints, the only way to advance an
iterator's state across a method call is to take the iterator by value
(consume it) and return the advanced version alongside the item.

The for-loop desugaring (§12.3.1) hides this verbosity from user code:
the user writes `for x in v:` and the compiler emits the rebind pattern
implicitly.

#### 12.7.2 Linear-ownership optimization

Because the for-loop's iterator binding is owned exclusively by the loop
and is reassigned only by the loop's internal desugaring, the iterator's
ownership is *linear* (single owner at every moment, no aliasing). The
compiler is required to recognize this pattern and emit in-place
cursor mutation — equivalent to the machine code produced for `&mut self`
methods in languages with mutable references.

Specifically, when:

1. The iterator type is statically known (monomorphized per §2.3),
2. The iterator binding is held in a single `mut` location (the
   for-loop's internal binding),
3. The `next` call's return value's `NewIter` component is
   immediately destructured and rebound to that same `mut` location,
   in a single statement, with no other reference to the consumed
   binding between the `next` call and the rebind.

Condition 3 holds by construction for the for-loop's internal
desugaring: the desugaring emits one statement that calls `next`,
destructures the returned tuple via pattern match, and rebinds the
iterator location to `NewIter` — all in one expression with no other
references possible. The compiler treats this pattern as a recognized
form.

When the three conditions hold, the compiler may compile the call as:
pass a pointer to the iterator's state, mutate the cursor in place,
return only the item value in registers. The "consumed" and "returned"
iterator are the same memory location; no copy occurs.

This optimization is a *required* property of conforming implementations,
not an optional optimization. The tuple-return trait shape is the source-
level pattern; the linear-ownership compilation is the performance
guarantee. Implementations that fail to optimize this pattern produce
code with iterator-cursor copies on every iteration, which is unacceptable
for the workloads loops are designed to serve.

#### 12.7.3 Implementing `Iterator`

A user-defined iterator implements `Iterator` by declaring the `Item`
associated type and the `next` method:

```
type SquareIter:
  next_value: i32
  limit: i32

fulfill Iterator for SquareIter:
  type Item = i32
  fn next(iter: SquareIter) -> (Option[i32], SquareIter):
    mut local = iter
    if local.next_value >= local.limit:
      (None, local)
    else:
      let value = local.next_value * local.next_value
      local.next_value = local.next_value + 1
      (Some(value), local)
```

This implementation receives the iterator by value, rebinds to a local
`mut` binding (per §11.7.3), mutates the cursor, and returns the result
alongside the (updated) iterator.

#### 12.7.4 Borrow-typed `Item`

The `Item` associated type may be a borrow type (`&T`) when the iterator
yields non-Copy elements from a source it borrows. This is one of the
narrow positions where `&T` is grammatically valid as a type expression
(see §11.9.5 for the complete list); the exception is bounded to the
`Iterator` trait and is justified by `Item` flowing into the for-loop
iteration variable position (§11.9.5, §12.3.3).

When `Item = &T`, the `next` method's return type becomes
`(Option[&T], Self)`. The `&T` appears inside `Option` and inside the
tuple, both of which are normally borrow-forbidden positions; the
exception applies specifically to this trait's `next` return.

A borrow-yielding iterator implementation:

```
type VecIter[T]:
  source: ...                       // internal: refers back to the borrowed Vec
  cursor: isize

fulfill Iterator for VecIter[Record]:
  type Item = &Record               // yields borrows of Record elements
  fn next(iter: VecIter[Record]) -> (Option[&Record], VecIter[Record]):
    mut local = iter
    if local.cursor >= local.source.length():
      (None, local)
    else:
      let element_ref = local.source.element_at(local.cursor)   // returns &Record
      local.cursor = local.cursor + 1
      (Some(element_ref), local)
```

The `element_at` operation is a stdlib primitive that produces a borrow
into the source's storage. The borrow's validity is tied to the
iteration step.

The trait declaration itself is unchanged:

```
trait Iterator:
  type Item
  fn next(iter: Self) -> (Option[Item], Self)
```

`Item` is unconstrained in the trait declaration. Implementations may
declare `Item` as `T` (owned) or `&T` (borrow). The choice depends on
which trait (`Iterable` or `IntoIterable`) provides the iterator and
on the source's element type:

- Iterators from `IntoIterable::consuming_iterator` always yield owned
  Item types. Each `next` call moves one element out of the iterator's
  internal storage (which holds the consumed source's buffer). Item is
  `T` regardless of whether T is Copy.
- Iterators from `Iterable::iterator` choose based on element type:
  Copy elements yield owned values (`Item = T`); non-Copy elements
  yield borrows (`Item = &T`).

The borrow's lifetime is bounded by the iteration body. The compiler
checks that the source value (the Vec, the Record array, etc.) is not
moved or mutated while iteration is active — same rule as §11.9.2 for
function-parameter borrows, applied per iteration.

### 12.8 The `Iterable` Trait

`Iterable` is the stdlib trait for types that can produce an iterator:

```
trait Iterable:
  type Iter: Iterator
  fn iterator(value: &Self) -> Iter
```

The associated type `Iter` is the iterator type produced; it must itself
implement `Iterator`. The method `iterator` takes a borrow of the source
and returns an iterator that will yield the source's elements.

#### 12.8.1 Method name

The method is named `iterator`, not `iter`. The language convention is
to prefer full names over abbreviations (§1.4 and following). Stdlib and
user code use the full name throughout.

#### 12.8.2 Borrow lifetime

The `iterator` method's parameter is `&Self`. The iterator's lifetime is
bounded by the borrow's scope — meaning, for a for-loop, the lifetime of
the loop expression itself. This is enforced by the same call-scoped
borrow rules of §11.9: while the for-loop is running, the source value
is borrowed and may not be mutated through its owner.

The `Iterable` trait is invoked by the *borrow form* of the for-loop:
`for x in &v:` dispatches through `Iterable::iterator(&v)`. The consume
form `for x in v:` dispatches through `IntoIterable` (§12.9) instead.

#### 12.8.3 Implementing `Iterable`

A user-defined container implements `Iterable` by declaring the iterator
type and the construction method:

```
type DataPoints:
  values: f32[256]
  count: isize

fulfill Iterable for DataPoints:
  type Iter = DataPointsIter
  fn iterator(d: &DataPoints) -> DataPointsIter:
    DataPointsIter(...)        // construct iterator over d's data
```

The `for x in &d` syntax then dispatches to this implementation
automatically.

### 12.9 The `IntoIterable` Trait

`IntoIterable` is the stdlib trait for types that can be *consumed* to
produce an iterator. The source value is moved into the iterator;
elements are yielded as owned values.

```
trait IntoIterable:
  type Iter: Iterator
  fn consuming_iterator(value: Self) -> Iter
```

The associated type `Iter` is the iterator produced; it must itself
implement `Iterator`. The method `consuming_iterator` takes the source
by value (consumes it) and returns an iterator that owns the source's
storage.

#### 12.9.1 Method name and dispatch

The method is named `consuming_iterator`. The full name signals that
ownership transfers — the source is gone after the call. The convention
follows §12.8.1 (full names over abbreviations).

The `IntoIterable` trait is invoked by the *consume form* of the
for-loop: `for x in v:` dispatches through
`IntoIterable::consuming_iterator(v)`. The source `v` is consumed at
loop entry; after the loop, the binding `v` is no longer usable per the
ownership rules of §11.

#### 12.9.2 Item type and ownership flow

Under `IntoIterable`, the iterator yields owned `Item` values directly.
For non-Copy `Item` types, each `next` call physically moves one element
out of the iterator's internal storage (which holds the source's
buffer). For Copy `Item` types, each `next` call yields a copy of the
element.

The iteration variable in the for-loop is bound to the yielded value
with full ownership. The body may move it into another binding, pass
it to consuming functions, store it elsewhere — anything an owned
value supports.

```
mut destinations = Vec::new()
let records: Vec[Record] = make_records()
for r in records:                       // consume form; r: Record (owned)
  if r.is_valid():
    destinations = destinations.push(r) // ✓ move r into destinations
                                         // (the predicate r.is_valid() reads via &Record
                                         //  borrow, available because methods can declare &T)
// records consumed; destinations holds the valid records
```

#### 12.9.3 Partial consumption and Drop

If the loop exits via `break` (or via an enclosing function return)
before exhausting the iterator, elements at positions not yet yielded
remain inside the iterator's internal storage. When the iterator is
dropped (at loop exit), the remaining elements are dropped per their
`Drop` semantics, and the underlying buffer is released.

The exact `Drop` mechanism for non-Copy types is specified in §Drop
Trait (deferred). For Copy types, drop is a no-op.

#### 12.9.4 Implementing `IntoIterable`

A user-defined container implements `IntoIterable` by declaring the
iterator type and the consuming method:

```
type DataStream:
  pending: Vec[Event]
  cursor: isize

fulfill IntoIterable for DataStream:
  type Iter = DataStreamIntoIter
  fn consuming_iterator(s: DataStream) -> DataStreamIntoIter:
    DataStreamIntoIter(...)    // takes ownership of s's pending events
```

The `for x in d` syntax (with `d: DataStream`) dispatches to this
implementation automatically, consuming `d`.

#### 12.9.5 Both `Iterable` and `IntoIterable` for the same type

Stdlib types typically implement both `Iterable` (borrowing iteration)
and `IntoIterable` (consuming iteration). The user picks at the call
site:

- `for x in v:` — `IntoIterable` dispatch; consumes v.
- `for x in &v:` — `Iterable` dispatch; borrows v.

A user-defined type may implement one, both, or neither. If a type
implements only `Iterable`, the consume form `for x in v` is a compile
error (no `IntoIterable` impl); the user must use `&v`. If it
implements only `IntoIterable`, the borrow form `for x in &v` is a
compile error.

There is no "reclaim after consumption." Once `consuming_iterator(v)`
is called, `v`'s binding is consumed and the source's elements are
either yielded (now owned by the body's bindings) or remaining in the
iterator (to be dropped when the iterator is dropped). If the user
needs the source after iteration, they choose the borrow form, or they
restructure to consume-and-rebuild (pass the source through a
transformation function that consumes and returns a new collection).

### 12.10 Built-in Iteration Sources

Stdlib provides both `Iterable` and `IntoIterable` implementations for
the language's built-in iterable types:

- **Ranges (`Range[T]`)** — `Range[T]` is `Copy`. Both forms work; from
  the user's perspective, `for i in 0..N:` and `for i in &(0..N):` are
  indistinguishable. The conventional form is the consume form.
- **Arrays (`T[N]`)** — implement both `Iterable` (borrow) and
  `IntoIterable` (consume). See §12.10.1 for details.
- **Stdlib collections** (`Vec[T]`, `HashMap[K, V]`, etc.) — implement
  both, with iterator types specific to each container. The specific
  Item types and yielding semantics are stdlib design decisions.

These implementations are language-privileged per §3.7.3 and are not
user-overridable.

#### 12.10.1 Iterating over arrays

Arrays implement both forms. The user picks at the call site:

**Consume form** (`for x in arr:`): the array is consumed. Each
iteration variable is owned `T`. After the loop, `arr` is no longer
usable.

For `T: Copy` (e.g., `f32[1024]`), the Copy element behavior is
identical to borrow form — `sample` is a Copy value either way:

```
let buf: f32[64] = make_block()
mut sum: f32 = 0.0
for sample in buf:                // sample: f32; buf consumed
  sum = sum + sample
// buf cannot be used after this loop
```

For non-`Copy` `T`, each iteration moves one element out of the array's
storage. The body has full ownership:

```
mut destinations = Vec::new()
let records: Record[16] = make_records()
for r in records:                  // r: Record (owned); records consumed
  destinations = destinations.push(r)
// records cannot be used; destinations holds all the records
```

**Borrow form** (`for x in &arr:`): the array is borrowed for the
duration of the loop. Each iteration variable is either `T` (for Copy
elements) or `&T` (for non-Copy elements). After the loop, the array
remains owned.

```
let buf: f32[64] = make_block()
mut sum: f32 = 0.0
for sample in &buf:               // sample: f32; buf borrowed
  sum = sum + sample
process(buf)                       // ✓ buf still owned

let records: Record[16] = make_records()
for r in &records:                 // r: &Record
  print(r.first_name)              // ✓ read access only
  consume(r)                       // ✗ cannot move out of borrow
process(records)                   // ✓ records still owned
```

While the array is borrowed (during the for-loop expression), indexed
writes (`arr[i] = v`) are forbidden per §11.9.2. Indexed reads
(`arr[i]`) are allowed (reading is non-disruptive).

#### 12.10.2 Iterating over ranges

`Range[T]` iteration is the basic counting pattern:

```
for i in 0..N:
  process(i)
```

`Range[T]` is `Copy` (for `T: Copy`, which all built-in integer types
satisfy). The consume form `for i in 0..N:` consumes a Copy value,
which is functionally indistinguishable from borrowing — the source
expression is a literal anyway, not a binding the user would want to
reuse. The borrow form `for i in &(0..N):` is also legal but rarely
used.

Ranges and their iterators are stack-allocated; iteration has no heap
overhead.

### 12.11 Iteration Performance

The combination of (1) the linear-ownership optimization for the
`Iterator::next` tuple-return pattern (§12.7.2), (2) monomorphization of
generic iterator implementations (§2.3), and (3) inlining of small
iterator methods produces machine code equivalent to hand-written
indexed loops.

For a typical numeric inner loop (DSP block processing, where the
buffer is needed after the loop):

```
mut sum: f32 = 0.0
for sample in &audio_block:
  sum = sum + sample * sample
// audio_block still owned; available for further processing
```

A conforming implementation compiles this to machine code with no heap
allocation, no iterator object lifecycle overhead, and no per-iteration
function call cost. The iterator's cursor is held in registers; the
`next` call is inlined; the loop is a tight machine loop over the
array's elements.

This performance behavior is a *required* property of conforming
implementations. The trait-based source-level abstraction is intended to
disappear at the machine level for monomorphized loops over built-in
iterables.

### 12.12 Interaction with the Rest of the Language

#### 12.12.1 Pattern matching and iteration variables

The iteration variable may be a pattern, not just a single name. The
pattern destructures each yielded value:

```
let pairs: Vec[(i32, string)] = ...
for (id, name) in pairs:
  process(id, name)
```

The pattern follows the rules of §6.2.4 and §9.2.2. Refutable patterns
(those that may fail to match) are not permitted as iteration variables;
the iteration variable must always bind successfully for each yielded
value. To filter, the body uses `continue`:

```
for x in items:
  match x:
    Special(payload): continue        // skip; for filtering, use continue
    Other(data): process(data)
```

A future extension may add `for pattern if guard in iterable:` syntax for
inline filtering; not in v1.

#### 12.12.2 Loops in trait method bodies

Trait method bodies may contain loops, subject to the standard mutation
and ownership rules. Default-body methods in trait declarations (§3.1.3)
may use loops:

```
trait Statistics:
  fn samples(value: &Self) -> Vec[f32]

  fn count_above(value: &Self, threshold: f32) -> isize:
    mut count: isize = 0
    let elements = samples(value)
    for s in elements:                   // consumes the returned Vec; s: f32 (Copy)
      if s > threshold:
        count = count + 1
    count
```

The default body's loop is part of the trait declaration; implementations
may override it as usual. The `samples` method here is abstract (no
default body); each implementation provides its own. The `count_above`
default body iterates the returned `Vec[f32]` to compute the result.

#### 12.12.3 Loops in generic function bodies

A generic function body containing a loop is type-checked at definition
per §2.2.2. The loop's iterable expression's type must satisfy
`Iterable` (for borrow form) or `IntoIterable` (for consume form) at
the call site for each monomorphization. Associated-type constraints
use `.` member-access notation per §3.1.2:

```
fn total[T: Iterable](source: &T) -> T.Iter.Item where T.Iter.Item: Numeric:
  mut sum = T.Iter.Item::zero()
  for sample in source:
    sum = sum + sample
  sum
```

The compiler verifies the constraints at definition and monomorphizes
per call site.

### 12.13 Interaction with Reactivity (Forward-Looking)

The reactive system is specified in a deferred section. Loops in
reactive contexts follow §11.14:

- A `derived` expression's body may contain loops. Each evaluation of
  the derived expression runs the loop fresh. The loop's local
  mutations are not observable outside the derived's evaluation; only
  the derived's final value enters the reactive graph.
- The collection or range being iterated in a derived body may itself
  be a reactive value. Each time the reactive value updates, the
  derived re-evaluates and the loop re-runs.
- The `while` loop's condition may depend on reactive values, but
  reactive updates do not interrupt an in-progress loop iteration.

Full specification is deferred to the reactive-system chapter.

### 12.14 Restrictions and Edge Cases

#### 12.14.1 Empty iteration

An empty iterable (such as `0..0` or an empty container) produces no
iterations. The loop's body does not execute. The expression value (in
expression context) is determined by the else-clause-and-break-value
table of §12.6.2:

```
let result = for x in []:           // hypothetical empty array
  break x
else:
  default_value
                                    // result = default_value
```

#### 12.14.2 Iterators that never complete

An iterator whose `next` always returns `Some(_)` produces an infinite
loop. There is no language-level prevention; the responsibility lies with
the iterator implementation. A `break` inside the body is the user's
mechanism for terminating such loops.

#### 12.14.3 Side effects in iterator implementations

`Iterator::next` is a pure function in the type-system sense: it takes
inputs and produces outputs. However, the iterator's value contains
state that the function may mutate (via `mut local`-style rebind in the
body). Different invocations of `next` produce different results because
the cursor advances; this is the normal behavior of iteration and does
not violate purity.

Iterators must not perform externally observable I/O. The reactive
system's signals (§13) are the appropriate mechanism for
externally-driven sequences; iterators are for collection traversal.

---

*End of §12.*

---

## 13. Reactive System

This section specifies the language's reactive composition layer: the
declaration kinds (`signal`, `attr`, `derived`), the composition
constructs (`node`, `connection`, parts), the rules governing reactive
expression evaluation, and the host API through which external code
drives and observes the reactive graph.

The reactive system is the language's mechanism for expressing values
that change over time. Ordinary computation in Symphony is pure and
immutable (§1.3, §11.1); change is confined to two contexts: local
mutation within a function body (§11) and the reactive system
specified here. The reactive system gives users a declarative way to
express "this value depends on these other values, and recomputes
when they change" without manually wiring update propagation.

### 13.1 Design Principles

The reactive system is built on six load-bearing principles.

**Declarative composition.** A reactive graph is built declaratively
from signal, attr, state, derived, node, and connection
declarations.
Placement syntax (§13.7) constructs instances. Composition is
structural — the graph's shape is known at compile time.

**Static graph.** Once constructed, the reactive graph's structure is
fixed for the lifetime of the kernel instance. Signals, attrs, nodes,
and connections are created at startup and not added or removed at
runtime — except by hot reload (§13.13), which replaces the program
source and applies a diff atomically.

**Pure evaluation surface.** Reactive expressions (`derived`
declarations, attr default expressions) are pure expressions over
signal, attr, and derived values. They contain no `mut` bindings, no
loops, no statement-level imperative constructs. When imperative work
is needed, the reactive expression calls a pure function (per §11),
which may use `mut` internally.

**Lazy, batched evaluation.** Writes (signal, attr, state) mark
dependent cells dirty without immediate recomputation. The kernel
evaluates the dirty set in topological order only when the host
explicitly calls `kernel.tick()` (§13.12.5). The publish operation
(§13.12.6) is a separate visibility event — it does no evaluation;
it atomically swaps the back buffer for consumer-visible
observation.

**Cycles broken by time.** The static dependency graph may contain
cycles (§13.9), but every cycle must pass through at least one
`state` declaration (§13.2.4) acting as a time-delay element. The
per-tick evaluation graph, obtained by treating state-cell reads as
inputs-from-previous-tick, is a DAG.

**Reactive vs imperative separation.** Reactive composition uses
nodes, parts, and connections. Imperative data structures (`Vec`,
`HashMap`, fixed-size arrays of more than one cell, etc.) hold
non-reactive data only. Reactive cell types are restricted (§13.10.4)
to types that fit single cells in the reactive state buffer (§14.3).

### 13.2 Reactive Declarations

The reactive system has four declaration kinds, distinguished by who
controls the value and how it changes over time.

#### 13.2.1 `signal`

```
signal name: Type = initial
```

A `signal` declares a writable reactive cell. The initial value is
supplied at the declaration. After construction, the value is written
only through the host API (§13.12.2); Symphony source has no
syntactic form for assigning to a signal.

Signals are program-level reactive entry points. They represent
inputs from outside the reactive graph — host events, sensor
readings, user input, scheduled values. The host pushes new values
into the kernel; the reactive graph propagates the changes.

```
signal mouse_x: i32 = 0
signal mouse_y: i32 = 0
signal mouse_button: bool = false
signal current_time_ms: i64 = 0
signal volume: f32 = 0.5
signal target_pitch: f32 = 440.0
```

Signals are declared only at module top level. They are program-wide
reactive entry points — inputs from outside the reactive graph.
Per-instance writable cells are the role of `attr` (§13.2.2);
per-instance self-advancing cells are the role of `state` (§13.2.4).

#### 13.2.2 `attr`

```
attr name: Type = default
```

An `attr` declares a writable reactive cell that is *per-instance* of
its enclosing node or connection type. Each instance carries its own
cell. Like signals, attrs are written only through the host API or
at placement time (§13.7).

```
node Driver:
  attr expertise_level: i32 = 5
  attr risk_tolerance: f32 = 0.5
  attr is_active: bool = true

node Synthesizer:
  attr master_volume: f32 = 1.0
  attr current_pitch: f32 = 440.0
```

The `default` expression provides the initial value used when an
instance is constructed without an explicit value for that attr.
Defaults may reference previously-declared attrs of the same node
(declaration order is significant; see §13.2.5).

The default may be a constant expression, an expression involving
other declared attrs, an expression involving signals visible in
scope, or any compile-time-evaluable expression.

```
node Filter:
  attr cutoff_hz: f32 = 1000.0
  attr resonance: f32 = self.cutoff_hz / 1000.0      // references earlier attr
  attr enabled: bool = true
```

At placement time, the user may override the default by supplying a
value (§13.7.2):

```
Filter f1:
  cutoff_hz: 500.0                    // override default
  // resonance and enabled use defaults
```

#### 13.2.3 `derived`

```
derived name: Type = expression
```

A `derived` declares a *read-only* reactive value defined by an
expression. The kernel maintains the value consistent with its
inputs: when any signal, attr, or other derived that the expression
reads changes, the expression re-evaluates (under the lazy-batched
rules of §13.8).

```
node Driver:
  attr expertise_level: i32 = 5
  attr risk_tolerance: f32 = 0.5
  derived skill_factor: f32 = self.expertise_level as f32 / 10.0
  derived is_aggressive: bool = self.risk_tolerance > 0.7
```

A derived's expression is a *pure expression* — no `mut`, no loops,
no statements. It may include:

- Arithmetic and comparison operations on reactive and non-reactive
  values.
- Reads of signals, attrs, and other deriveds (these create
  reactive dependencies).
- Field accesses and indexed reads.
- Function calls (functions are reactive-transparent; §13.10.2).
- Pattern matching (`match` expressions).
- Conditional expressions (`if`/`else`).
- Closure construction (the closure captures values at construction
  time; §13.10.3).

The expression's *provenance* — the set of reactive cells it reads,
including transitively through function calls — determines its
dependency set. When any cell in the dependency set changes, the
derived becomes dirty and is recomputed on the next publish.

#### 13.2.4 `state`

```
state name: Type = initial
  next: expression
```

A `state` declares a *per-instance* writable cell that advances its
value on each tick (§13.8). State cells are the mechanism for
cyclic reactive patterns — IIR filters, sequencers, integrators,
delay lines — to carry values across ticks.

A state declaration has two required parts:

- **`= initial`** — the value the cell holds before the first tick.
- **`next:` expression** — a pure reactive expression evaluated each
  tick whose result becomes the cell's value for the next tick.

Both parts are required. A `state` without `next:` is a compile
error; use `attr` instead if the cell is host-written only.

```
node Filter:
  attr input: f32 = 0.0
  state previous_output: f32 = 0.0
    next: self.current_output
  derived current_output: f32 =
    0.5 * self.input + 0.5 * self.previous_output
```

##### 13.2.4.1 Lockstep advancement

Within a tick, state cells advance in **lockstep**: all `next:`
expressions read the *current* values of state cells (their
end-of-previous-tick values), compute new values, and commit
together at end-of-tick. No state cell sees another state cell's
just-advanced value within the same tick.

This is the standard synchronous-dataflow semantics (Lustre,
Esterel, Verilog `<=` non-blocking assignment). It gives clean
denotational semantics: state at the end of tick N is a pure
function of state at the end of tick N-1 and the inputs received
during tick N.

##### 13.2.4.2 State vs attr

`attr` and `state` are both per-instance writable cells. The
distinction is who advances the value:

- `attr` cells change only when the host writes via
  `kernel.write_attr`. The kernel does not advance them.
- `state` cells advance automatically each tick per the `next:`
  expression. Hosts may also write them directly via
  `kernel.write_state` (e.g., for resetting a filter).

Use `attr` for parameters, configuration, and host-controlled
inputs. Use `state` for cells that carry computed values across
ticks autonomously.

##### 13.2.4.3 State cells in cycles

State cells are the only declarations whose participation in a
dependency cycle is permitted. The cycle-validity rule (§13.9.2)
requires every static cycle to pass through at least one `state`
declaration. The state cell breaks the cycle via lockstep
advancement: dependents read the cell's current value (set at end
of previous tick); the cell's `next:` expression is computed this
tick from those dependents' results.

Instantaneous cycles (cycles consisting only of derived-to-derived
edges, or attr-only cycles with no state cell) are compile errors.

#### 13.2.5 Initial value rules

Initial values are computed in a single startup pass:

1. **Signals** are initialized first, in declaration order. Each
   signal's `= initial` expression is evaluated. Signal initializers
   may reference other signals declared earlier in the same module.
2. **Per-instance attrs** are initialized when their containing
   instance is placed. For each instance, attrs are initialized in
   declaration order. Each attr's `= default` expression is
   evaluated against the just-initialized attrs of the same instance
   (declaration order matters) and against signals (which are
   already initialized from step 1).
3. **Per-instance state cells** are initialized similarly: each
   `state X: T = initial` cell receives its `initial` value at
   placement time. The `next:` expression is *not* evaluated at
   startup — state cells hold their initial values until the first
   tick.
4. **Deriveds** are evaluated last, in topological order over the
   per-tick DAG. Each derived computes its initial value from the
   now-initialized signals, attrs, and state cells. State cells'
   initial values serve as the "previous-tick" source for cyclic
   reads during this startup evaluation.

Bootstrap order:

- Within a node's attr or state declarations, defaults and initial
  values may reference previously-declared cells of the same node.
  Referencing a later-declared cell in a default is a compile
  error.
- At type-declaration time, attr defaults and state initial values
  may reference only same-instance cells (via `self.X`), top-level
  signals, and compile-time-evaluable expressions. They cannot
  reference cells of other instances. Cross-instance references
  are resolved only at placement time, not at type declaration.

#### 13.2.6 No mutation of cells from Symphony source

Symphony source has no syntactic form for assigning to a signal,
attr, state, or derived after declaration. Source-level expressions
read reactive cells; they do not write to them.

Writes occur only through:

- The host API (`kernel.write_signal`, `kernel.write_attr`,
  `kernel.write_state`, `kernel.transaction`) per §13.12.
- Placement-time initial values for attrs and state cells
  (per §13.7.2).
- The kernel's own evaluation of `derived` expressions, which
  writes the derived's output cell with the newly computed value.
- The kernel's own evaluation of `next:` expressions on `state`
  cells, which commits the computed value at end-of-tick
  (per §13.8.3 and §13.2.4.1).

The "no source-level write" rule applies to all four declaration
kinds uniformly. Symphony programs describe the reactive graph;
they do not imperatively modify it from within.

### 13.3 Nodes

A `node` is a nominal type whose instances live in the reactive
graph as composable units. A node bundles attrs, deriveds, parts,
and connection-endpoint declarations into a single named
abstraction.

#### 13.3.1 Declaration

```
node TypeName[GenericParams]?:
  satisfies Trait1, Trait2     -- optional trait conformance
  parts: Type1, Type2          -- optional permitted part types
  in: Conn1, Conn2             -- optional incoming connection types
  out: Conn3, Conn4            -- optional outgoing connection types
  attr name: Type = default    -- per-instance writable cells
  derived name: Type = expr    -- per-instance reactive values
```

All body items are optional. A node with no attrs, no deriveds, no
parts, and no connections is legal but typically unused.

```
node Driver:
  satisfies Drivable
  out: Drives
  attr expertise_level: i32 = 5
  attr risk_tolerance: f32 = 0.5
  derived is_aggressive: bool = self.risk_tolerance > 0.7
```

#### 13.3.2 `satisfies` clause

A node may declare trait conformance via `satisfies` (§3.2). Trait
methods are implemented via `fulfill` blocks (§3.3); node bodies
themselves do not contain `fn` declarations. Functions on node
instances are free functions taking the node type as a parameter,
callable via uniform call syntax (§3.4).

```
trait Displayable:
  fn display(value: Self) -> string

node Driver:
  satisfies Displayable
  attr expertise_level: i32
  attr risk_tolerance: f32

fulfill Displayable for Driver:
  fn display(d: Driver) -> string:
    "Driver(exp: {d.expertise_level}, risk: {d.risk_tolerance})"
```

#### 13.3.3 `parts` clause

```
parts: Type1, Type2, ...
```

The `parts` clause lists the *types* of child node instances that
may be placed inside instances of this node at placement time. The
clause does not place any specific instances — it constrains what
types of children are permitted; the actual children appear at
placement (§13.7.3).

```
node Synthesizer:
  parts: Oscillator, Filter, Amplifier
  attr master_volume: f32 = 1.0
```

A node without a `parts` clause cannot contain children. A node
with a `parts` clause may contain zero or more children of each
listed type, placed at construction time.

#### 13.3.4 `in` and `out` clauses

```
in: ConnType1, ConnType2
out: ConnType3, ConnType4
```

The `in` and `out` clauses list the *types* of connections in which
instances of this node may participate as endpoints. `in` connections
target this node (the node is the `to` endpoint); `out` connections
originate from this node (the node is the `from` endpoint). See
§13.5 for connection declarations and §13.7.4 for connection
placement.

#### 13.3.5 Generic parameters

A node may declare generic parameters in the standard `[T, U, ...]`
form. Generic parameters are in scope within the body's attr,
derived, parts, and connection declarations:

```
node Buffer[T: Numeric]:
  attr capacity: usize = 16
  attr fill_level: usize = 0
  derived utilization: f32 =
    self.fill_level as f32 / self.capacity as f32

  parts: BufferSlot[T]
```

Each instantiation of `Buffer` with a different concrete `T`
produces a distinct node type with its own cells. Monomorphization
follows §2.3.

#### 13.3.6 No methods in node body

A node body does not contain `fn` declarations. Behavior associated
with a node type lives as free functions whose first parameter is
the node type, or as `fulfill` blocks implementing trait methods.
Calls are made via uniform call syntax per §3.4.

This separation enforces the "node bodies are declarative" rule:
nodes describe structure and reactive content; functions and
methods are imperative computation, distinct in kind.

### 13.4 Parts

"Part" is a *role*, not a separate type. A part is a child node
instance placed inside a parent node at construction time. The
parent declares the types of children it accepts via its `parts:`
clause (§13.3.3); the specific instances appear via placement
(§13.7.3).

#### 13.4.1 The `self.parts` form

Inside a node body's reactive expressions and function bodies that
take the node type as a parameter, the structural collection of
parts is accessible as `self.parts` (in reactive contexts) or
`instance.parts` (in function bodies receiving the node).

`self.parts` is *not* a Vec, array, or runtime collection. It is a
compile-time-known structural iterable: the compiler knows the
identity and count of every part of a given instance, because the
graph is static (§13.1).

#### 13.4.2 Iteration over parts

A function body may iterate `self.parts` (or `parent.parts`) using a
`for` loop:

```
fn total_output(s: Synthesizer) -> f32:
  mut sum: f32 = 0.0
  for p in s.parts:
    sum = sum + p.output
  sum

node Synthesizer:
  parts: Oscillator
  derived total: f32 = total_output(self)
```

The compiler unrolls the `for` loop at compile time, emitting
direct references to each declared part:

```
fn total_output(s: Synthesizer) -> f32:
  s.parts[0].output + s.parts[1].output + ... + s.parts[N-1].output
```

(Schematic; the actual lowered code references parts by their
placement-time names.)

#### 13.4.3 Reactive dependency tracking through parts

When a function called from a reactive expression iterates parts,
each part's reactive cells contribute to the calling expression's
dependency set. In the example above:

- `total_output(self)` reads `p.output` for each part.
- Each `p.output` is a derived on the part.
- The `Synthesizer.total` derived's dependency set includes every
  part's `output` derived.
- When any one part's `output` changes, `total` is dirty.

This works because dependency tracking is provenance-based (§13.10.1):
the compiler tracks reactive cells read by an expression,
transitively through function calls.

#### 13.4.4 Restrictions

- Parts are bound to placement-time names. A node may contain at
  most one part of each name; multiple parts of the same type with
  different names are permitted.
- Parts are not added or removed at runtime (except via hot reload).
- Heterogeneous parts (different types per part) are supported only
  when each part has a distinct name and the iteration expects a
  trait that all part types satisfy. For homogeneous parts (one
  type), iteration is straightforward (see §13.4.2). For
  heterogeneous parts, see §13.4.5.

#### 13.4.5 Heterogeneous parts

A node may declare multiple part types:

```
node Composite:
  parts: Oscillator, Filter, Amplifier
```

Each placed part has a distinct name. Iteration via `for p in
self.parts` over heterogeneous parts produces a sequence of values
of mixed types. In v1, this is supported only when:

- All part types satisfy a common trait, AND
- The iteration body accesses only that trait's methods/attrs.

In other cases, the user accesses each part by name. Parts are
named at placement time (§13.7.3), not in the `parts:` clause:

```
node Composite:
  parts: Oscillator, Filter, Amplifier

Composite c1:
  Oscillator osc1
  Filter flt1
  Amplifier amp1

fn process(c: Composite) -> f32:
  // Direct access by part name
  let raw = c.osc1.output
  let filtered = c.flt1.filter(raw)
  c.amp1.amplify(filtered)
```

The `parts:` clause lists only types; names appear at placement.

### 13.5 Connections

A `connection` is a directional link between two node instances. A
connection is itself a nominal type that may carry attrs and
deriveds. Connections are first-class entities, not just references:
they have identity, state, and reactive content.

#### 13.5.1 Declaration

```
connection TypeName[GenericParams]?:
  from: SourceType       -- required, exactly once
  to: DestType           -- required, exactly once
  attr name: Type = default
  derived name: Type = expr
```

The `from` and `to` clauses declare the endpoint *types*. Exactly
one of each is required. `from:` and `to:` are not attributes —
they are endpoint slots, first-class structural elements of every
connection. Attribute syntax (placement-time `name: expr` settings,
inline pipes, flags) does not target them.

```
connection Drives:
  from: Driver
  to: Drivable
  attr enhanced_handling: bool = false
  attr aggressiveness: f32 = 0.5
  derived effective_speed: f32 =
    to.top_speed * (from.expertise_level as f32 / 10.0)
```

A connection body does not contain `fn` declarations, paralleling
node bodies (§13.3.6).

#### 13.5.2 `from` and `to` references in expressions

Inside a connection's `derived` expressions and attr defaults, the
identifiers `from` and `to` refer to the connection's endpoints.
They behave like instance references; their attrs and deriveds are
accessible via the usual `.` notation.

`from` and `to` are bound at the connection's *placement* time —
each connection placement specifies its source (the enclosing
instance) and its destination (typically via the `/expr` form or
the `to:` endpoint-slot syntax in the connection's body). Inside
the connection's body, `from` and `to` resolve to those specific
instances.

#### 13.5.3 Generic connections

Connections may declare generic parameters:

```
connection Contains[T]:
  from: Container[T]
  to: T
  attr index: usize = 0
```

Generic parameters scope over the connection's `from`, `to`, attrs,
and deriveds. Each unique instantiation produces a distinct
connection type per §2.3.

#### 13.5.4 No methods in connection body

A connection body does not contain `fn` declarations. Functions on
connections are free functions taking the connection type, dispatched
via uniform call syntax. Trait methods are implemented in `fulfill`
blocks. Same rule as nodes (§13.3.6).

### 13.6 The `self` Keyword

`self` is a context-restricted keyword that resolves to the instance
currently being declared or constructed.

#### 13.6.1 Scope

`self` is available only inside the body of a node or connection
declaration. Specifically, in:

- Attr default expressions: `attr x: i32 = self.other_attr + 1`.
- Derived expressions: `derived y: bool = self.x > 0`.
- Iteration over parts in reactive expressions inside a node body:
  `for p in self.parts: ...`. Inside free functions that receive
  the node as a parameter, the parameter name (developer-chosen)
  is used to refer to the instance, not `self`.

`self` is *not* available in:

- Record or enum body declarations.
- Trait declarations (use the capitalized `Self` for the type-level
  identifier per §3.1.1).
- Free function bodies, including functions whose first parameter
  is a node or connection type. Such functions use the parameter's
  name to refer to the instance.
- Module top-level scope.

```
node Driver:
  attr expertise_level: i32 = 5
  attr risk_tolerance: f32 = 0.5
  derived skill_factor: f32 = self.expertise_level as f32 / 10.0
                                   //  ^^^^ self inside node body — valid

fn aggressive(d: Driver) -> bool:
  d.risk_tolerance > 0.7        // function uses parameter name, not self
```

#### 13.6.2 Resolution and reactive dependencies

A reference through `self` to an attr or derived participates in the
reactive dependency graph in the usual way. `derived x: f32 =
self.y + 1` depends on `self.y`; when `self.y` changes, `x` becomes
dirty.

For each *instance* of the type, `self` resolves to that specific
instance. The compiler emits dependency edges per-instance: instance
`A` of `Driver` has a `skill_factor` cell whose dependency set
includes instance `A`'s `expertise_level` cell, not the cell of
some other Driver instance.

#### 13.6.3 Self vs Self (lowercase vs capitalized)

The capitalized `Self` is the type-level identifier used in trait
declarations and `fulfill` blocks (§3.1.1). It refers to the
implementing type, not an instance.

The lowercase `self` is the instance-level identifier used in node
and connection bodies. It refers to a specific instance at
runtime.

The two are distinct: `Self` is a type-system concept usable only
in type positions; `self` is a value usable only in expression
positions inside node/connection bodies. They never overlap.

### 13.7 Placement

*Placement* is the syntax for instantiating nodes, parts, and
connections into a concrete reactive graph. It is distinct from
value construction of records (which uses constructor syntax per
§6.1.3).

#### 13.7.1 Top-level instances

A top-level placement creates a named instance of a node type at
module scope:

```
Driver john_doe:
  expertise_level: 10
  risk_tolerance: 0.8
  Drives/some_car | enhanced_handling: true | aggressiveness: 0.8
```

The first line is `TypeName instance_name:`. The body sets
attributes and declares child parts and connections (§13.7.3,
§13.7.4).

Instance names are unique within their declaring scope. Two
top-level placements with the same name in the same module is a
compile error.

#### 13.7.2 Setting attributes

A line `name: expr` inside a placement body sets the named attr of
the enclosing instance:

```
Driver john_doe:
  expertise_level: 10         // sets attr `expertise_level`
  risk_tolerance: 0.8         // sets attr `risk_tolerance`
```

The attr must be declared on the placed type. Setting a
non-declared attr is a compile error. The value's type must match
the attr's declared type (subject to the standard widening rules).

Attributes may also be set via inline pipes (§13.7.7) or flags
(§13.7.8). The three mechanisms target the same underlying cells;
setting the same attr via two mechanisms is a compile error
(duplicate-set).

If an attr is not set at placement, its declared default applies.

#### 13.7.3 Child parts

A line beginning with a type name (no `:` immediately after the
first identifier) declares a child placement — a part or a
connection:

```
Component chip_b:
  label: "B"                              // attr setting
  Pin out1                                // child part (Pin instance named out1)
  Pin in1                                 // another child part
```

A child placement that names a node type listed in the parent's
`parts:` clause is a part. The placement creates an instance of
that node type as a child of the parent.

Disambiguation: a line is an *attribute setting* if it has `: expr`
immediately after the first identifier; otherwise it is a
*placement*.

#### 13.7.4 Connections

A child placement whose type is a connection type creates a
connection from the enclosing instance (which becomes the `from`
endpoint) to some destination (the `to` endpoint). The destination
is specified either via the `/expr` form (§13.7.5) or via an
explicit `to:` clause in the connection's body. `to:` (and `from:`,
if explicitly specified) are endpoint-slot syntax — distinct from
attribute settings — and target the connection's structural
endpoints, not its attrs.

```
Component chip_b:
  Pin out1
    WiresTo/chip_a.in1 | resistance: 50      // connection from out1 to chip_a.in1
    WiresTo/chip_a.in2 | resistance: 75
```

The enclosing instance becomes the connection's `from`; the
expression after `/` becomes the connection's `to`. The connection
type must match a type listed in the enclosing instance's `out:`
clause (or in the type's traits' contributions).

#### 13.7.5 The `/expr` form

A connection placement may specify its `to` endpoint inline using
`/expr` immediately after the type name (and any flags), before any
optional instance name and before any inline attribute pipes. The
full syntax is specified in the inline placement spec (which §13
incorporates as §13.7.7 onward); the form is illustrated:

```
Drives/some_car | enhanced_handling: true | aggressiveness: 0.8
```

This places a `Drives` connection whose `to` endpoint is `some_car`,
with two attrs set inline. Equivalent body form:

```
Drives:
  to: some_car             // endpoint-slot syntax (not an attribute)
  enhanced_handling: true  // attribute setting
  aggressiveness: 0.8      // attribute setting
```

The `/expr` form is the conventional choice for connection
placements; it consolidates the endpoint slot (`to`) into a
positional slot adjacent to the type.

#### 13.7.6 Disambiguation summary

Within a placement body, each non-blank line falls into one of two
categories:

- **Attribute setting:** `Ident : Expr`. Sets an attr of the
  enclosing instance.
- **Placement:** `TypeRef [Flags]? [InstanceName]? [/Expr]? [| AttrPipe]*` followed by an optional `:` and indented body. Creates a child part or connection.

The parser distinguishes the two by what follows the first
identifier: `:` (with an expression after) → attribute setting;
otherwise → placement.

#### 13.7.7 Inline attribute pipes

After the `TypeRef` (and optional flags, instance name, and `/expr`
slot) of any placement, zero or more attribute pipes may follow on
the same line. Each pipe is introduced by `|`. Three syntactic
forms:

```
| name: value      -- set attribute `name` to expression `value`
| name             -- set boolean attribute `name` to true
| !name            -- set boolean attribute `name` to false
```

```
Sensor s1 | gain: 0.5 | active | !calibrated
```

Setting the same attribute via two pipes on one placement, or via
an inline pipe and the placement body, is a compile error
(duplicate-set, parallel to the rule for record-field
duplicate-set).

Pipes target attrs declared on the placed type (directly or
inherited via satisfied traits). The expression in `| name: value`
must match the attr's type subject to standard widening rules.
The boolean-true (`| name`) and boolean-false (`| !name`) forms
require the attr to be of type `bool`; non-boolean attrs used with
the bare form are a compile error.

#### 13.7.8 Flags

A *flag* is a single non-letter character appearing adjacent to a
placed type's `TypeRef` (no intervening whitespace), aliasing a
boolean attribute of the type.

```
Pin' p1                            // ' is a flag on Pin
Component?* c1                      // two flags: ? and *
```

Flags are declared on attr declarations via the `@flag('c')`
annotation:

```
node Pin:
  @flag('!')
  attr reverse_polarity: bool = false

  @flag('\'')
  attr is_power: bool = false
```

The annotation argument is a `char` literal per §9.1.2. Only boolean
attrs may carry `@flag`; non-boolean attrs with `@flag` are a
compile error.

##### 13.7.8.1 Flag character set

The permitted flag characters are:

```
' ! ? * + ^ ~ @ $ #
```

Each is a non-letter character not part of identifier syntax.

##### 13.7.8.2 Flag-character uniqueness

Within a type's effective attribute surface (its own attrs plus
those inherited via satisfied traits), each flag character must be
unique. Two attrs claiming the same flag character is a compile
error at the type declaration site, identifying both attrs.

##### 13.7.8.3 Flag semantics

At a placement site, each flag character in the run resolves to the
boolean attr it aliases, setting that attr to `true`. There is no
flag form for setting `false`; users who need to override a
default-`true` attr to `false` use the inline pipe `| !name`.

The asymmetry — flags set true only — is deliberate. Flags are for
the *unusual* case; the default should be chosen so most placements
omit the flag.

##### 13.7.8.4 Flag/operator disambiguation

Several flag characters double as operator tokens elsewhere in the
language:

- `'` is both a flag and the opener of a `char` literal (§9.1.2).
- `?` is both a flag and the postfix Try operator (§8.4).
- `@` is both a flag and the annotation prefix (`@derive`).
- `!` is both a flag and the boolean-NOT operator.

Disambiguation is positional: in placement position, a non-letter
character immediately following the `TypeRef` path (no intervening
whitespace) is a flag-run opener. In any other position
(expression context, annotation context, etc.) it is the operator.

```
Pin' p1                            // flag run after TypeRef (placement context)
let c: char = '\''                 // char literal in expression context
let r = some_fallible()?           // postfix Try in expression context
@derive(Eq) type Point:            // annotation prefix in declaration context
  ...
```

##### 13.7.8.5 No duplicate-set across forms

A boolean attr may be set via at most one mechanism per placement:
the flag form, the inline pipe form (`| name` or `| !name`), or the
body form (`name: expr`). Using two mechanisms on the same attr in
one placement is a compile error.

```
Pin' p1 | reverse_polarity: false    // ✗ duplicate: ' flag and pipe both target reverse_polarity
```

The diagnostic class is the same as duplicate-set for attribute
pipes (§13.7.7).

#### 13.7.9 Ordering of inline parts

A placement's inline parts have a fixed order:

```
TypeRef [FlagsRun]? [InstanceName]? [DefaultArgPart (`/Expr`)]? [AttrPipe]*
```

- Flags immediately adjacent to TypeRef (no whitespace).
- Optional instance name follows the type/flags.
- The `/Expr` default-arg slot (connection-only) follows the name.
- Inline pipes follow last.

Example:

```
WiresTo'! my_wire / chip_b.in1 | resistance: 50 | reverse_polarity
^^^^^^^^                                              -- TypeRef + 2 flags
         ^^^^^^^^                                     -- instance name
                  ^^^^^^^^^^^^                        -- /Expr (connection target)
                               ^^^^^^^^^^^^^^^        -- pipe 1
                                                ^^^^^^^^^^^^^^^^^  -- pipe 2
```

The `/Expr` form is permitted only on connection placements; on
node placements it is a compile error.

### 13.8 Reactive Evaluation

The kernel separates two events: **tick** advances the program's
semantic clock and performs all reactive evaluation; **publish**
makes the latest evaluated state visible to consumers. Both events
are host-triggered. They are independent — host code may tick many
times before publishing, publish without ticking, or pair them
one-to-one.

#### 13.8.1 Lazy evaluation

A signal write (via `kernel.write_signal` per §13.12.2) records the
new value in the reactive state buffer's back-buffer cell and marks
all directly-dependent cells dirty. **No derived recomputation
happens at write time.** The kernel maintains a dirty-set bitvector
for the reactive graph; signal writes set bits.

The same lazy property applies to `kernel.write_attr` and
`kernel.write_state`: write, mark dirty, defer recomputation.

This decouples writes from evaluation. Multiple writes between
ticks batch automatically: each write marks dirty cells;
recomputation happens at the next tick for the union.

#### 13.8.2 Tick-triggered evaluation

The kernel evaluates dirty cells and advances state cells only
when the host calls `kernel.tick()`. The host owns the tick
cadence:

- An audio host may tick once per audio sample or once per audio
  block.
- A UI host may tick once per frame.
- A simulation host may tick once per simulation step.
- A test harness may tick manually between specific writes.

The kernel itself does not impose any cadence. It is fully passive
with respect to time.

#### 13.8.3 Tick cycle

On `kernel.tick()`, the kernel runs the following sequence on the
producer thread:

1. **Snapshot the dirty set.** No new dirty bits are added during
   the rest of the tick cycle (until the tick completes).
2. **Compute evaluation order.** Topologically sort the dirty cells
   over the per-tick DAG (§13.9): cycles in the static graph are
   broken by treating state-cell reads as inputs-from-previous-tick.
3. **Evaluate `next:` expressions in lockstep.** For each `state`
   cell, evaluate its `next:` expression against the *current*
   values of all state cells (their end-of-previous-tick values).
   The just-computed next values are held aside; they do *not*
   become visible within this step. (Lockstep — §13.2.4.1.)
4. **Invoke derived behaviors.** For each dirty derived in
   topological order, invoke the behavior (per §14.6's ABI). The
   behavior reads its inputs from the back buffer (which contains
   accumulated signal/attr writes since the previous tick plus
   any earlier-evaluated derived results in this tick) and writes
   its output to the back buffer. State-cell reads return current
   values (end-of-previous-tick).
5. **Commit state advancement.** Write the next values computed
   in step 3 into the state cells. After this step, state-cell
   reads return their newly-advanced values.
6. **Clear dirty bits.** Ready for the next tick.

The tick cycle leaves the back buffer in a fully consistent state.
It does not affect what consumers see; consumer visibility advances
only at publish (§13.8.4).

#### 13.8.4 Publish

`kernel.publish()` performs an atomic swap of the current-buffer
pointer (§14.3.3.1). It is a visibility-only operation: it performs
no evaluation, no state advancement, no dirty-bit processing. Cost
is one atomic pointer store.

Consumers observing the kernel via `kernel.swap()` see the previous
publish's state until publish completes. After publish, on their
next swap, they see the most-recently-completed-tick's state.

Three legal patterns:

- **Tick then publish (typical).** One tick advances state and
  evaluates dirty cells; publish exposes the result. Audio
  applications, UI frames.
- **Many ticks, one publish.** Batch simulation, fast-forwarding,
  deterministic test scenarios. Consumers see only the final tick's
  result; intermediate ticks are invisible.
- **Publish without preceding tick.** Idempotent — consumer's next
  swap returns the same state. Useful if consumer needs to refresh
  a view without state having advanced.

The "writes batch until tick" property combines with the
"ticks batch until publish" property: programs can have arbitrary
write/tick/publish patterns without affecting consumer-visible
correctness.

#### 13.8.5 Topological order and tiebreaker

Within a tick cycle, dirty deriveds evaluate in topological order
over the per-tick DAG. Topological order ensures that each
derived's dependencies have stable values when the derived itself
is evaluated.

When two deriveds are at the same level (neither depends on the
other), the compiler chooses a deterministic tiebreaker:
**source declaration order**. The derived declared earlier in
source order evaluates first. Since the two are not dependency-
related, the choice does not affect correctness — but determinism
matters for reproducibility (same program, same inputs, same
output trace).

For deriveds across different node instances at the same level,
the placement order at construction time is the tiebreaker.

`next:` expressions across multiple state cells evaluate in lockstep
(§13.2.4.1); no internal ordering between them is observable.

#### 13.8.6 Transactions

The host may opt into transactional batching of multiple writes
that should commit as one logical change:

```
kernel.transaction(|tx| {
  tx.write_signal(a_id, new_a);
  tx.write_signal(b_id, new_b);
});
```

Writes within a transaction accumulate in the back buffer and
commit atomically at transaction close. Properties:

- **Panic during the closure:** trap-track semantics of §13.11.1
  apply — the process aborts. There is no rollback; the back-buffer
  state at the moment of abort is irrelevant because the process
  is terminating. Atomicity of grouped writes is trivially
  preserved by process death.
- **Nesting:** nested transactions are flattened — only the
  outermost `kernel.transaction` commits. Inner `kernel.transaction`
  calls are no-ops with respect to publish. All writes since the
  outer transaction's start are committed together at outer close.
- **Cancellation:** an explicit `tx.abort()` method rolls back the
  transaction's accumulated writes. The closure returns normally;
  the back buffer is restored to its pre-transaction state. This
  is the only rollback path.
- **Relationship to tick and publish:** transaction close commits
  writes to the back buffer. It does not tick; dirty cells remain
  dirty until the next `kernel.tick()`. It does not publish;
  visibility to consumers waits on `kernel.publish()`.
  Transactions provide *atomicity of grouped writes*; ticks
  provide *evaluation*; publishes provide *visibility*.

Outside transactions, individual `kernel.write_*` calls behave as
if each were its own one-write transaction.

### 13.9 Cycle Handling

Static cycles in the dependency graph are permitted, but only when
broken by at least one `state` declaration (§13.2.4).

#### 13.9.1 The static dependency graph

The compiler constructs the static dependency graph by walking
every `derived` expression's body and `next:` expression's body,
recording for each the set of cells it reads. Edges go from the
read cells to the derived (or to the state cell whose `next:`
expression reads them). Signal, attr, derived, and state-cell
reads all contribute edges.

The graph may contain cycles. For example:

```
node Filter:
  attr input: f32 = 0.0
  state previous_output: f32 = 0.0
    next: self.current_output
  derived current_output: f32 =
    0.5 * self.input + 0.5 * self.previous_output
```

`current_output` reads `previous_output`; `previous_output`'s
`next:` expression reads `current_output`. This is a static cycle,
broken by the state cell's lockstep advancement.

#### 13.9.2 The cycle-validity rule

> Every static cycle in the dependency graph must pass through at
> least one `state` declaration.

The state cell breaks the cycle: dependents read its current
value (set at end of previous tick); the cell's `next:` expression
is evaluated this tick from those dependents' results and commits
at end-of-tick (§13.2.4.1).

Cycles passing only through `attr` cells, or only through `derived`
cells (or both, with no `state` cell anywhere), are not valid.

#### 13.9.3 The per-tick evaluation graph

To evaluate a tick cycle, the kernel constructs the *per-tick DAG*
by treating every state-cell read as an *input* to this tick — its
value is whatever was committed at the end of the previous tick,
not what will be committed at the end of this tick. This breaks
all valid cycles, producing a DAG.

The per-tick DAG is what gets topologically sorted in §13.8.3
step 2.

#### 13.9.4 Compile-time cycle detection

The compiler performs static cycle analysis on the dependency
graph:

- Cycles passing through one or more `state` declarations are
  valid; state cells act as delay elements via lockstep
  advancement.
- Cycles consisting only of derived→derived edges (or
  attr→derived edges with no state cell on the cycle) are
  *instantaneous cycles* and represent the unsolvable
  "a depends on b depends on a" situation within a single tick.
  These are rejected at compile time with an error identifying
  the cycle's members.

The compiler emits a diagnostic naming each instantaneous cycle
and suggesting introduction of a state declaration:

```
error: instantaneous cycle in reactive graph
  derived `a.x` depends on `b.y`
  derived `b.y` depends on `a.x`
  hint: introduce a `state` declaration on the cycle to break it
```

#### 13.9.5 State cells as delay elements

A state cell on a cycle behaves as a z⁻¹ delay element: it always
reads the previous tick's committed value, regardless of what its
`next:` expression computes this tick. The end-of-tick commit
(§13.8.3 step 5) is what advances the cell for the next tick to
observe.

This is the same semantic primitive used by hardware registers
(Verilog `<=` non-blocking assignment), synchronous-dataflow
languages (Lustre `fby`), and signal-flow audio languages
(Faust `~`). The kernel does not require any per-implementation
convention beyond the language-level `state` declaration; the
behavior is fully specified.

### 13.10 The Reactivity Boundary

The reactivity boundary determines which expressions become reactive
and which remain ordinary computation.

#### 13.10.1 Provenance tracking

The compiler computes, for each expression, its *provenance set*:
the set of reactive cells (signals, attrs, derived results) the
expression reads, including transitively through function calls and
field accesses. An expression is *reactive* iff its provenance set
is non-empty.

The compiler uses provenance to:

- Decide which cells to include in a derived's dependency set
  (used by the dirty-bit propagation in §13.8.1).
- Diagnose reactivity-where-compile-time-required errors with
  precise blame: *"value of `x` is reactive because it depends on
  signal `mouse_position` at line 14."*
- Reject use of reactive values in positions where compile-time-
  known values are required (§2.4.2).

#### 13.10.2 Functions are reactive-transparent

A function body is not itself reactive. A function takes parameters
as ordinary values and returns ordinary values; it has no knowledge
of signals, attrs, or deriveds beyond what its parameters carry.

Reactivity emerges at the call site, not in the function body. When
a reactive expression calls `some_fn(signal_a, signal_b)`, the
expression's provenance set includes `signal_a` and `signal_b`
(plus the transitive provenance of any reactive reads inside
`some_fn` — see below).

When `signal_a` or `signal_b` changes, the containing reactive
expression becomes dirty and re-evaluates. Re-evaluation re-runs
`some_fn` with the new argument values. The function sees only
the new concrete values; it never observes "the signal."

##### 13.10.2.1 Transitive provenance through functions

If a function's body reads a reactive cell directly (e.g., reads
a signal declared at module scope), the function's return value
inherits that provenance. Calling such a function from a reactive
expression adds the directly-read cells to the expression's
provenance set.

```
signal global_offset: f32 = 0.0

fn shifted(x: f32) -> f32:
  x + global_offset                    // reads signal `global_offset`

derived adjusted: f32 = shifted(self.base_value)
                       // provenance = { self.base_value, global_offset }
```

The compiler's provenance analysis is transitive — it follows
function calls to find all reactive reads. Module-level globals
read by called functions are included.

##### 13.10.2.2 Conservative branching

When a function's body branches based on its arguments, the
provenance contribution of each branch is computed independently
and unioned. If branch A reads cell X and branch B reads cell Y,
the function contributes {X, Y} to its callers, even though only
one branch executes per call. This is a conservative
over-approximation: cell Y is included in dependency sets even
when the A branch is taken, potentially causing unnecessary
re-evaluation. This is correct (the system never under-tracks
dependencies) and is the standard reactive-runtime treatment.

#### 13.10.3 Closures snapshot reactive values

Per §11.10, closures capture by value (Copy types only). If a
closure is constructed with a reactive value in scope, it captures
the value at construction time as a snapshot — not the live cell.

```
let current_threshold: f32 = some_signal    // snapshot at this moment
let predicate = |x: f32| x > current_threshold
                        // closure captures the snapshotted f32 value, not the signal
```

Calling `predicate` later does *not* observe subsequent changes to
`some_signal`. The closure is not reactive in the sense of
participating in the dependency graph.

To use a value reactively, the user writes a derived expression
that reads the reactive cell directly (or calls a function that
reads it). Closures are for snapshot semantics; derived expressions
are for live reactive semantics.

#### 13.10.4 Restricted reactive cell types

Reactive cells (signal, attr, state, derived values) are restricted to
types that fit a single cell in the reactive state buffer (§14.3).
Specifically:

**Permitted:**

- Primitives: `i8`–`i128`, `u8`–`u128`, `isize`, `usize`, `f32`,
  `f64`, `bool`, `char`.
- `string` (refcounted-shared handle in cell, content in pool per
  §14.5).
- Tuples of all-`Copy` components whose total size fits one cell.
- Records with `@derive(Copy)` whose total size fits one cell.
- `Result[T, E]` and `Option[T]` where the total bit width (tag
  discriminant + maximum payload variant) fits a single cell.
  A `Result[i32, i32]` with a 1-bit discriminant fits 64 bits; a
  `Result[i64, i64]` does not (discriminant pushes the total past
  the cell). The compiler verifies the bit-width budget at
  type-checking time.

**Not permitted as reactive cell types in v1:**

- `Vec[T]`, `HashMap[K, V]`, and other heap-allocated dynamic-size
  collections.
- Fixed-size arrays `T[N]` (even when N is small).
- Records or tuples whose total size exceeds one cell.
- `dyn` trait objects.
- Functions and closures.

For "collection of reactive things" patterns, users compose via
parts (§13.4): a parent node with N parts of the same child type,
each part holding its own attrs/deriveds. This is the canonical
reactive composition mechanism. Non-reactive collections (`Vec`,
`HashMap`) hold non-reactive data only.

Multi-cell record values that span more than one cell are
intentionally excluded from reactive cells in v1 to keep the
storage model simple. Future versions may relax this for
narrow-multi-cell types (`i128`, small records spanning 2-3 cells)
via the same triple-buffer mechanism, but it is not part of v1.

#### 13.10.5 Reactivity vs compile-time evaluation

A reactive value cannot be used where a compile-time-known value
is required (§2.4.2, §2.4.4). Specifically:

- Array sizes: `i32[some_signal]` is a compile error.
- Const-generic arguments: `Buffer[some_signal]` is a compile
  error if `some_signal` flows into a const-generic position.
- `const` declarations: a `const` whose RHS is reactive is a
  compile error per §2.4.1.2.

The compiler tracks reactivity provenance to provide precise
diagnostics for these cases.

### 13.11 Error Handling in Reactive Contexts

Symphony's two-track failure model (§8.1) applies uniformly to
reactive contexts.

#### 13.11.1 Traps abort the process

A derived expression that traps during evaluation — from arithmetic
overflow under default operators (§4.6.1), division by zero, an
out-of-range array index, or explicit `panic` — follows the
trap-track semantics of §4.6.1: the process aborts.

The kernel does not isolate traps within behavior invocations. There
is no "errored cell" sentinel state at the kernel level, no
`catch_unwind` boundary, no continuation past a trap. A trap is a
bug, and bugs end the program.

#### 13.11.2 Recoverable failures via value-track errors

Programs that need to handle recoverable failures use the
value-track error model (§8). Specifically: declare the derived's
type as `Result[T, E]` (or `Option[T]`), have the expression
produce `Err(...)` (or `None`) explicitly for failure cases via
checked arithmetic operators (§4.6.4) or pattern matching, and
propagate through `?` or `match` in downstream expressions.

```
node Divider:
  attr numerator: f32
  attr denominator: f32
  derived quotient: Result[f32, DivideError] =
    if self.denominator is 0.0:
      Err(DivideError::ByZero)
    else:
      Ok(self.numerator / self.denominator)

node Consumer:
  in: from_divider: Divider
  derived report: string =
    match self.from_divider.quotient:
      Ok(value): "result: {value}"
      Err(DivideError::ByZero): "result: undefined"
```

The divide-by-zero case never traps; it produces `Err(...)`. The
`Consumer.report` derived handles both branches explicitly. No
kernel-level error machinery is involved.

For arithmetic operations that may overflow but should produce
recoverable errors, use the checked variants (`+?`, `-?`, etc.)
per §4.6.4. Their results are `Option[T]` values that flow through
the type system.

#### 13.11.3 The reactive context is not an exception

The reactive evaluation context does not modify Symphony's trap
semantics. A behavior that traps aborts the process, same as a
free function or function-body trap. Authors expecting graceful
handling must use value-track errors; the language does not
provide a hidden recovery mechanism.

### 13.12 Host API

The kernel exposes an API for host code (the application embedding
the kernel) to drive and observe the reactive graph. The shape of
the API is normative; the specific syntax in user-facing code
depends on the host language (Rust, etc.) and is implementation-
defined.

#### 13.12.1 Lifecycle

The kernel's lifecycle proceeds in phases:

**Startup:**
1. Load metadata (per §14.7).
2. Allocate the reactive state buffer (per §14.3).
3. Initialize signal cells with their declared initial values (in
   declaration order).
4. Initialize attr cells with their declared defaults (per-instance,
   in declaration order within each instance, with placement
   order across instances).
5. Initialize state cells with their declared initial values
   (per-instance, in declaration order within each instance). The
   `next:` expressions are *not* evaluated at startup; they run
   only on the first `kernel.tick()`.
6. Run the initial derived evaluation in topological order over
   the per-tick DAG. Each derived computes its initial value from
   the now-initialized signals, attrs, and state cells. State
   cells' initial values serve as the "previous-tick" source for
   cyclic reads during this pass.
7. Perform the first publish (the first atomic current-pointer
   swap per §14.3.3.1). Consumers' subsequent swaps return real
   data.

The kernel is "constructing" through steps 1–6; "live" after step
7 completes. Consumer reads via swap before step 7 return a
sentinel (or block, per implementation choice).

**Steady-state operation:**

- Host calls `kernel.write_signal(...)`, `kernel.write_attr(...)`,
  `kernel.write_state(...)`, `kernel.transaction(...)` to update
  reactive state. Writes mark dirty bits; no evaluation runs.
- Host calls `kernel.tick()` to advance the program's clock —
  state cells advance their values (lockstep) and dirty deriveds
  re-evaluate.
- Host calls `kernel.publish()` to make the most-recently-ticked
  state visible to consumers (atomic pointer swap).
- Consumer threads call `kernel.swap(...)` to obtain the latest
  published state and read cell values.

**Shutdown:**
1. Stop accepting new signal/attr/state writes.
2. Drain any in-flight tick (the current tick, if running,
   completes; the kernel does not run an extra tick on shutdown).
3. Drop reactive cells in reverse-of-construction order: connections
   drop before their endpoint instances; within each instance,
   attrs, state cells, and deriveds drop in reverse declaration
   order (per §14.9 Drop rules).
4. Drop top-level signals.
5. Drop string pool entries (per §14.5).
6. Deallocate the reactive state buffer.
7. Kernel is terminated. Subsequent consumer swaps return a sentinel.

#### 13.12.2 `kernel.write_signal`

```
kernel.write_signal(signal_id, value)
```

Writes a new value to the cell of the named signal. The call is
synchronous and inexpensive: it updates the back buffer's cell and
sets the dirty bit for dependents. No evaluation runs at this
point.

The call must be made from the producer thread (the kernel's
designated thread for write/evaluation/publish operations; see
§14.8). Other threads write to signals indirectly by enqueueing
requests for the producer thread to apply — that's a
host-application concern, not a kernel concern.

The `signal_id` is obtained at compile time from the graph
metadata (each signal has a stable ID assigned during compilation,
per §14.7).

#### 13.12.3 `kernel.write_attr`

```
kernel.write_attr(instance_id, attr_id, value)
```

Writes a new value to the cell of a specific instance's attr.
Otherwise behaves identically to `kernel.write_signal`: synchronous,
back-buffer-only, dirty-bit propagation, no evaluation.

`instance_id` identifies the instance (assigned at compile time per
placement); `attr_id` identifies the attr on that instance's type.

#### 13.12.4 `kernel.write_state`

```
kernel.write_state(instance_id, state_id, value)
```

Writes a new value to the cell of a specific instance's state
declaration, overriding what its `next:` expression would have
produced. Use cases: resetting filter state, snapping a sequencer
to a specific step, scrubbing a delay line.

Otherwise behaves identically to `kernel.write_attr`: synchronous,
back-buffer-only, dirty-bit propagation, no evaluation. The next
tick's `next:` expression evaluates against the host-written value
(treating it as the previous-tick committed value).

#### 13.12.5 `kernel.tick`

```
kernel.tick()
```

Advances the program's semantic clock by one step. Runs the tick
cycle of §13.8.3 on the producer thread:

- Evaluates `next:` expressions for all state cells in lockstep.
- Re-evaluates dirty deriveds in topological order over the
  per-tick DAG.
- Commits state-cell advancements at end-of-tick.

Synchronous; blocks until the tick completes. Does *not* publish;
the new state remains in the back buffer until `kernel.publish()`
exposes it to consumers.

Cost is bounded by the size of the state-declaration set plus the
size of the dirty-derived set.

The host chooses the tick cadence per its domain: audio hosts tick
per audio sample or block; UI hosts tick per frame; simulation
hosts tick per simulation step. The kernel imposes no cadence and
makes no assumptions about what one tick represents.

#### 13.12.6 `kernel.publish`

```
kernel.publish()
```

Performs an atomic swap of the back buffer pointer (§14.3.3.1).
Visibility-only: no evaluation, no state advancement, no dirty-bit
processing. Cost is one atomic pointer store — O(1).

Consumer threads see the new state on their next swap. Calling
publish without a preceding tick is idempotent (consumer's next
swap returns the same state).

#### 13.12.7 `kernel.transaction`

```
kernel.transaction(|tx| {
  tx.write_signal(a_id, new_a);
  tx.write_signal(b_id, new_b);
})
```

Provides atomic grouping of writes. Properties:

- The transaction's closure executes synchronously.
- Writes within the closure accumulate in the back buffer; a
  snapshot of the pre-transaction back-buffer state is preserved
  to support `tx.abort()`.
- On successful completion, the writes are committed (the snapshot
  is discarded).
- **On panic within the closure**, the trap-track semantics of
  §13.11.1 apply: the process aborts. There is no rollback; the
  back-buffer state at the moment of abort is irrelevant because
  the process is terminating. Atomicity of grouped writes is
  trivially preserved by process death. The savepoint mechanism
  exists only for `tx.abort()`, not for panic recovery.
- **On `tx.abort()`** (called from within the closure), the back
  buffer is rolled back to the pre-transaction snapshot. The
  closure returns normally; no panic is raised. This is the only
  rollback path.
- **Nesting:** nested transactions flatten — only the outermost
  `kernel.transaction` commits. Inner `kernel.transaction` calls
  are no-ops with respect to commit; their writes accumulate into
  the outer transaction and commit together at outer close.

Transactions provide *atomicity of grouped writes*. They do not
tick; dirty cells remain dirty until the next `kernel.tick()`.
They do not publish; consumer visibility requires a subsequent
`kernel.publish()`.

#### 13.12.8 `kernel.swap`

```
kernel.swap() -> BufferView
```

Called by a consumer thread to obtain a view of the latest
published state. The call is wait-free: a single atomic load of
the current-pointer per §14.3.3.2.

The returned view provides cell-read access. Reading a cell from
the view is wait-free: a single atomic load. The view remains
valid until the consumer next calls swap; subsequent calls obtain
a new view (potentially pointing at a different buffer if the
producer has published in the interim).

Consumers may hold multiple views concurrently if needed; the
triple-buffer arrangement allows the producer to continue
publishing without disturbing held views.

### 13.13 Hot Reload of the Reactive Graph

The kernel supports hot reload of the reactive graph when the host
provides updated source code (per §14.11). The reactive system's
specific hot reload semantics are as follows.

#### 13.13.1 Compile-time validation gate

Before any kernel-side action occurs, the new source must compile
under the full Symphony type system (§§1–12) and reactive system
rules (§13). If compilation fails — for any reason, including
dangling references to nodes removed in the new source — the hot
reload is rejected. The kernel continues running the previously-
loaded version, unaffected.

This ensures the kernel never enters a state where compiled
behaviors reference cells that no longer exist or have changed
type.

#### 13.13.2 Cell identity across reloads

Reactive cells are identified across reloads by their *fully-
qualified declaration path*: the dotted sequence of module path,
instance name, and attribute or signal name. For example,
`audio.synth_a.osc_1.frequency`.

When a cell with the same fully-qualified path exists in both old
and new source AND has the same type, it is treated as the *same
cell*. Its value is preserved across reload.

When a cell exists in old but not in new, it is a *removal* — the
cell is dropped during reload.

When a cell exists in new but not in old, it is an *addition* — a
new cell is allocated and initialized per the new source's
declared initial value or default.

When a cell exists in both but with different type, it is treated
as removal of the old + addition of the new.

#### 13.13.3 Reload sequence

The kernel performs the reload atomically on the producer thread,
in the following order:

1. Compile new source. On failure, reject reload; kernel state
   unchanged.
2. Acquire a reload lock. Pause acceptance of new signal/attr
   writes from host code (host requests queue).
3. Let any in-flight publish complete; ensure the kernel is in a
   between-publishes state.
4. Compute the diff between old and new graphs: which cells are
   surviving (same path, same type), which are added, which are
   removed.
5. For added cells: allocate space in the reactive state buffer
   and initialize per the new source.
6. For removed cells: invoke their Drop per §14.9, in
   reverse-declaration order. Connections drop before endpoint
   instances; within each instance, attrs, state cells, and
   deriveds drop in reverse declaration order.
7. Update the behavior table (§14.6.4): register behaviors with
   new content-addressed IDs; deregister behaviors no longer
   present. Behaviors with unchanged content-addressed IDs are
   carried over.
8. Run a re-initialization evaluation pass: for each derived
   whose behavior body changed (different content-addressed ID
   from old to new), recompute its initial value from current
   inputs. For deriveds whose body is unchanged, the value
   persists.
9. Publish the reloaded state (atomic current-pointer swap).
10. Release the reload lock. Resume signal/attr writes; apply any
    queued writes to the new state.

#### 13.13.4 Constraints on reloadability

Some changes are not safely hot-reloadable and require full kernel
restart:

- Changes to the layout of the reactive state buffer that would
  require relocating live cells. The reload's diff-and-apply
  approach handles incremental changes but not whole-buffer
  reorganization.

Implementations detect these cases during the diff phase and
either reject the reload or schedule it as a restart-required
reload. The kernel diagnoses which class of change occurred.

### 13.14 Interaction with the Implementation (§14)

§13 specifies the reactive system's source-level semantics; §14
specifies the implementation model. Cross-references:

- Reactive cells (signal, attr, state, derived) live in the
  triple-buffered reactive state buffer per §14.3. Single-cell
  types (per §13.10.4) map to single AtomicI64 cells.
- The producer role per §14.8 is the kernel's reactive evaluation
  thread. It applies host writes to the back buffer, runs tick
  cycles (state-cell `next:` evaluation, derived behavior
  invocations), and performs the publish swap. In typical
  deployments, the host's main thread plays the producer role;
  in other deployments, a kernel-configured thread does.
- The consumer role per §14.8 is any thread reading published
  state via swap. Consumer threads do not invoke behaviors; they
  read the results of past ticks made visible by the most recent
  publish.
- Behaviors invoked during reactive evaluation — both derived
  expressions and state-cell `next:` expressions — conform to the
  ABI of §14.6: a uniform `fn(kernel: &KernelHandle, instance:
  InstanceId) -> ()` signature, with stateless semantics and
  content-addressed identity (§14.6.4).
- The graph metadata (§14.7) carries the structural information
  the kernel needs to construct the reactive state buffer, build
  dependency edges, distinguish attr cells from state cells, and
  dispatch behaviors.
- Hot reload at the source level (§13.13) maps to the §14.11
  mechanism: the kernel diffs behaviors and cells between old
  and new compiled output, applies the diff atomically, and
  publishes.

---

*End of §13.*

---

## 14. Implementation Model

This section specifies the contract between a Symphony program and its
runtime environment: how Symphony source is compiled, how the resulting
artifacts interact with the host kernel, and what guarantees the
implementation provides.

The contents of this section are *normative for implementations* of
Symphony, not for source-level code. Symphony programs do not depend on
these details directly; their behavior is determined by §§1–13. But
implementations must conform to the contracts specified here to ensure
that programs run correctly across implementations.

### 14.1 Compilation Modes

A conforming Symphony implementation provides two compilation modes:

**Interpreter mode** — Symphony source compiles to a compact bytecode
representation, executed by an interpreter embedded in the kernel.
Used for development workflows: fast iteration, hot reload, live
coding.

**Native mode** — Symphony source compiles, via a Rust intermediate
form, to a native executable. Used for production: maximum performance,
distributable artifact.

Both modes share the same frontend: lexer, parser, type checker,
semantic analysis. The frontend produces a typed intermediate
representation. The two modes diverge after this point: the bytecode
emitter targets the interpreter; the Rust emitter targets a Rust source
file that is then compiled by `rustc`.

The two modes produce equivalent observable behavior. A program that
runs correctly in interpreter mode produces the same output (modulo
performance and timing) in native mode. Implementations that diverge
observably between modes are non-conforming.

#### 14.1.1 The shared frontend

The frontend performs:

1. **Lexing and parsing** per `GRAMMAR.md`. Produces an AST.
2. **Name resolution and type checking** per §§2–10. Produces a typed
   AST with all generic instantiations resolved and all trait dispatch
   sites bound to concrete implementations.
3. **Borrow and ownership checking** per §11. Catches use-after-move,
   borrow conflicts, and other ownership violations.
4. **Reactive analysis** per §13 (forthcoming). Identifies reactive
   declarations, computes dependency graphs, and extracts graph
   metadata.
5. **Monomorphization** per §2.3. Resolves all generic instantiations
   in Symphony before lowering. Symphony's compiler does not delegate
   monomorphization to Rust; emitted code is fully concrete.

After these passes, the typed IR is consumed by one of the two
backends.

#### 14.1.2 Interpreter mode

The bytecode emitter lowers the typed IR to a stack-based bytecode.
The kernel includes a bytecode interpreter that executes this directly.
No native compilation step occurs.

Characteristics:
- Sub-second compilation time, suitable for live editing.
- Performance lower than native (a typical interpretation overhead is
  5–20× slower in tight loops; acceptable for development).
- Supports hot reload (§14.11): individual behaviors can be replaced
  in a running kernel without restarting.
- The bytecode format is implementation-internal and not stable across
  Symphony versions. It is not a distribution format.

#### 14.1.3 Native mode

The Rust emitter lowers the typed IR to Rust source code, which is then
compiled by the bundled `rustc` toolchain into a native executable. The
resulting binary is the distribution artifact.

Characteristics:
- Native performance, equivalent to hand-written Rust for the
  equivalent program.
- Compilation time is dominated by `rustc` (typically seconds to tens
  of seconds for non-trivial programs).
- Produces a single executable embedding both the compiled behaviors
  and the graph metadata (§14.7).
- Does not support hot reload at runtime; rebuild is required to
  change the program.

The emitted Rust source is **fully monomorphic and trait-free**. Per
§14.10, the Rust emitter produces concrete struct definitions and
specialized function definitions per Symphony instantiation. Symphony's
trait system is not exported into the emitted Rust; trait dispatch
sites are resolved to direct function calls during frontend processing.

### 14.2 The Symphony CLI

A conforming implementation provides a command-line interface that
wraps the compilation modes. The CLI's interface is normative; specific
flag spellings may vary across implementations, but the operations are
required.

#### 14.2.1 Operations

- **`symphony run <file>`** — invokes interpreter mode. Compiles to
  bytecode and executes immediately. The kernel runs to program
  completion or until interrupted.

- **`symphony watch <file>`** — interpreter mode with file watching
  and hot reload. The kernel runs continuously; saved changes to the
  source trigger recompilation and reload of affected behaviors per
  §14.11.

- **`symphony build <file> [--release]`** — invokes native mode.
  Compiles via Rust to a native executable. `--release` enables
  optimization. The output is a single executable file.

- **`symphony check <file>`** — runs the frontend (lexing, parsing,
  type checking, ownership checking, reactive analysis) without
  invoking either backend. Produces diagnostics. Used by editor
  integrations (LSP).

- **`symphony fmt <file>`** — invokes the canonical formatter.
  Rewrites the source in normalized form.

- **`symphony test <file>`** — runs tests via interpreter mode.
  Optimized for fast feedback during development.

#### 14.2.2 Toolchain bundling

The CLI ships as a single binary that bundles or downloads on first
use:
- The Symphony frontend.
- The bytecode interpreter (part of the kernel).
- A `rustc` toolchain for native-mode builds.
- The Symphony stdlib and reactive kernel.

Users do not install `rustc` or `cargo` separately. The CLI does not
expose `cargo` directly; all Rust-toolchain invocations are internal.
Build output from `rustc` is suppressed in normal operation and
surfaced only when a compilation failure prevents Symphony's output
from being produced.

#### 14.2.3 Project layout

A Symphony project is a directory tree containing source files
(`.sym`). The CLI does not require a manifest file for single-file
programs (`symphony run file.sym` works on a lone file). Multi-file
projects use a manifest file specifying the entry point and any
external dependencies; the format of the manifest is
implementation-specific.

### 14.3 The Reactive State Buffer

The kernel maintains a contiguous memory region holding all reactive
cells of the running program. This region is the **reactive state
buffer**.

#### 14.3.1 Cell representation

Cells are 64-bit slots, each one `AtomicI64` in implementations
targeting threaded platforms (native, modern browsers with COOP/COEP
headers, etc.). The complete buffer has type `Arc<[AtomicI64]>` in the
reference Rust implementation.

A single cell directly stores any 8-byte-or-smaller primitive value
via bit reinterpretation:

| Type | Storage in cell |
|---|---|
| `bool`, `char` | Single cell; value occupies the low bits, upper bits are zero. |
| `i8`–`i64`, `u8`–`u64` | Single cell; value is sign- or zero-extended to 64 bits as needed. |
| `f32`, `f64` | Single cell; value is bit-reinterpreted (transmute) as i64. |
| `string` | Single cell; value is a u64 handle into the string pool (§14.5). |

Lossless conversion: reading and writing a cell preserves the
bit-exact value of any of these primitive types. `f64::from_bits` and
`f64::to_bits` perform the reinterpretation in the reference Rust
implementation.

#### 14.3.2 Multi-cell types

Types wider than 8 bytes (`i128`, `u128`, multi-field records used as
reactive values) occupy multiple consecutive cells in the buffer.

For example, an `i128` value occupies two cells: the low 64 bits in
cell N, the high 64 bits in cell N+1.

A record `Vec3 { x: f32, y: f32, z: f32 }` used as a reactive cell
value occupies one cell per field — three consecutive cells per
`Vec3`, each padded from 4 bytes to 8 bytes. This per-field layout
is the **canonical** layout; implementations conforming to the spec
must support it.

An implementation may optionally pack multiple sub-8-byte fields
into a single cell as an optimization (e.g., three f32s into one
8-byte slot with the fourth slot unused, or four `bool` fields into
the low bits of one cell). Such packing is an implementation
optimization and must not be observable from Symphony source — every
cell read and write through the kernel API must produce results
identical to the canonical per-field layout.

Records whose fields total more than 8 bytes each (e.g., fields of
type `i128` or nested non-Copy records) follow the same per-field
layout, with multi-cell types occupying their own consecutive cells
within the enclosing record's allocation.

#### 14.3.3 Triple-buffering

The reactive state buffer is **triple-buffered** to provide:
- Snapshot consistency across multiple cells for multi-cell values.
- Batched publication: writes accumulated in the back buffer commit
  atomically when the producer publishes.
- Wait-free reads from the consumer.

The arrangement is **single-producer, single-consumer (SPSC)**: one
*producer role* writes, one *consumer role* reads, mediated by three
buffer copies and an atomic current-pointer swap. The mapping of
these roles to physical threads, and the trigger that initiates a
publish, are specified in §13 (reactive system); §14 specifies only
the mechanism.

The kernel maintains three copies of the buffer:

- **Current**: the most recently published snapshot. Read by the
  consumer. Not written while serving as current.
- **Back**: actively being written by the producer. Not read by the
  consumer.
- **Pending**: a third buffer used to allow the producer to begin
  writing the next batch of state without waiting for the consumer.
  Rotation among the three is producer-managed.

##### 14.3.3.1 Publish operation

To publish accumulated writes, the producer performs:
1. Finalizes writes to the back buffer.
2. Atomically swaps the "current" pointer to point at the
   newly-written back buffer. The previous "current" rotates to
   become the next available back/pending buffer.

The publish operation runs on the producer role's thread. Its cost
is O(N) where N is the buffer size — the producer copies the
publishable state into the back buffer before the swap. The atomic
swap itself is O(1).

The producer's per-publish cost is therefore O(N) memcpy + one
atomic operation. This cost is paid on the producer side, not on
the consumer side; consumers are unaffected.

When the producer chooses to publish (the trigger for which is
specified in §13) is outside the scope of this section.

##### 14.3.3.2 Swap operation

The consumer, when it wants to read the latest published state,
performs **swap**:
1. Atomically load the current pointer.
2. Read cells from the buffer it points to.

The swap operation runs on the consumer role's thread. Its cost is
O(1) — one atomic load. The consumer never copies data; it reads in
place from the buffer the current pointer points to.

##### 14.3.3.3 Why three buffers

A two-buffer ping-pong would force the producer to wait for the
consumer to finish reading before publishing the next state. With
three buffers, the producer always has a buffer available to write
to that the consumer is not currently reading, even when the
consumer holds its reference into a snapshot for an extended period.
This preserves wait-free reads on the consumer side without
producer-side blocking.

##### 14.3.3.4 Multiple cross-thread observers

If a deployment requires multiple cross-thread observers (multiple
consumers reading the same producer's published state), the SPSC
triple buffer can be replicated — each observer maintains its own
SPSC channel against the producer. SPMC variants are possible but
not required for the language's basic operation; the specification
defines SPSC as the canonical mechanism.

#### 14.3.4 Wide-atomic optimization (optional)

On platforms with hardware support for 128-bit atomic operations
(x86_64 with `CMPXCHG16B`, ARM64 with `LDXP`/`STXP`), the
implementation may use in-place 128-bit atomic updates for `i128` and
`u128` cells rather than relying on the triple-buffer publish cycle.
This is an optimization, not a correctness requirement; the
triple-buffer mechanism provides correct semantics on all platforms.

Platforms without wide-atomic support (WebAssembly, ARM32, etc.) rely
exclusively on the triple-buffer mechanism. Programs using `i128` or
`u128` reactive cells on such platforms function correctly; they pay
the full per-publish cost for those cells.

### 14.4 What Lives in the Reactive State Buffer

Only **reactive cells** live in the triple-buffered reactive state
buffer. Specifically, the values held by:

- `signal` declarations.
- `attr` declarations on node and connection instances.
- `derived` declarations (the cached computed value).

Regular Symphony values — local bindings (`let`/`mut`) inside function
bodies, function parameters, function return values, iterator state,
closure captures, ordinary record/array/tuple values used as
non-reactive data — do **not** live in the reactive state buffer.
They are normal Rust values in stack or heap memory, governed by the
ownership and borrow rules of §11.

A record type may appear in both contexts in the same program. As the
value of a signal/attr/derived declaration, it occupies cells in the
reactive buffer. As a local value, parameter, or non-reactive field,
it lives in regular memory. The Symphony compiler determines storage
location based on the declaration site, not the type.

### 14.5 Strings and the String Pool

Strings are variable-length and refcount-shared per §11.6. Their
storage requirements do not fit the fixed-size cell model of the
reactive buffer.

The kernel maintains a separate **string pool** that stores all string
content. The pool is logically a refcounted-shared, append-mostly
arena: each unique string is stored once and shared via reference
counts.

Reactive cells of type `string` store a **handle** (u64) into the pool
rather than the string content itself. The handle indexes the pool;
the pool resolves the handle to the actual `Arc<str>` data.

#### 14.5.1 Cross-thread consistency

The pool is shared across all three buffer copies. Buffer copies hold
handles; the pool holds the data. This separation allows:

- Buffer publish cost to remain O(N) in *cell count*, not in *string
  content size*. Changing a 1-megabyte string updates a single 8-byte
  handle in the buffer; the megabyte of data is allocated once in the
  pool, not three times in three buffer copies.

- Strings to be referenced by multiple cells (in the same or different
  buffers) via shared handles. Refcounting ensures the data is
  reclaimed when no buffer holds the handle.

#### 14.5.2 Pool operations

- **Allocation**: the producer (§14.8) allocates a new string in the pool;
  pool returns a handle. Refcount initialized to 1 for the cell that
  will hold it.
- **Refcount increment**: when a handle is copied into another cell,
  the pool's refcount on that string increments.
- **Refcount decrement**: when a cell is overwritten or buffer is
  retired, the previous handle's refcount decrements. If refcount
  reaches zero, the pool reclaims the string's storage.
- **Lookup**: consumer thread reads a handle from the buffer, looks
  up the corresponding `Arc<str>` in the pool (wait-free with proper
  pool structure).

The pool's allocation and refcount operations are atomic but may
block briefly under contention. These operations are performed by
the producer role (§14.8); the consumer role only reads via handles,
which is wait-free. The role-to-thread mapping is specified in §13.

### 14.6 The Behavior ABI

Every executable unit of a Symphony program — a derived expression
body, a function body called from a reactive context, a modulation
function — is exposed to the kernel via a uniform **behavior ABI**.

#### 14.6.1 Behavior signature

Every behavior has the same calling convention:

```
fn behavior(kernel: &KernelHandle, instance: InstanceId) -> ()
```

- `kernel`: a borrowed handle to the kernel, used for reading and
  writing reactive cells, allocating strings, and other kernel
  services.
- `instance`: an opaque identifier for the specific node or connection
  instance the behavior is being invoked for (relevant for `attr` and
  `derived` declarations on a particular instance).

The behavior reads its inputs from kernel cells via the handle,
performs its computation, and writes its outputs (if any) back to
kernel cells. Return value is unit; all effects are side effects
through the kernel handle.

This uniform shape means the kernel maintains a single function
pointer table: `Vec<fn(*const KernelHandle, u64) -> ()>` (in the
reference Rust implementation). The kernel invokes behaviors by index
into this table; no per-behavior dispatch logic is needed.

#### 14.6.2 Statelessness

Behaviors are **stateless** at the kernel level. All state lives in
reactive cells (attrs, signals, derived results). Behaviors are pure
transformations: read inputs from cells, compute, write outputs.

A "stateful" computation (filter with sample history, oscillator with
phase, accumulator) is structured as a record whose attrs hold the
state, plus a behavior that reads the state-attrs, computes new
state, and writes back to the state-attrs.

Local mutation within a behavior (`mut` bindings, indexed assignment,
iterator state) is permitted per §§11–12. These mutations are visible
only within the behavior's invocation; they do not escape.

#### 14.6.3 Error handling

A behavior may **trap** (§4.6) during evaluation — e.g., from
arithmetic overflow under the default `+` operator, division by
zero, an out-of-range array index, or an explicit `panic` call.

Symphony's two-track failure model (§8.1) applies to behaviors
without modification. Traps follow the trap-track semantics of
§4.6.1: the process aborts. The kernel does not isolate behavior
traps; there is no "errored cell" sentinel state, no `catch_unwind`
boundary, and no continuation past a trap.

Authors expecting recoverable failure must use the value-track
error model. Specifically: declare the derived's value type as
`Result[T, E]` (or `Option[T]`), have the behavior body produce
`Err(...)` for failure cases via explicit checking, and propagate
through `?` (§8.4) or `match` in downstream expressions. Errored
state is then a value flowing through the type system, not a kernel
sideband.

Example:

```
node Divider:
  attr numerator: f32
  attr denominator: f32
  derived quotient: Result[f32, DivideError] =
    if self.denominator is 0.0:
      Err(DivideError::ByZero)
    else:
      Ok(self.numerator / self.denominator)

node Consumer:
  in: from_divider: Divider
  derived report: string =
    match self.from_divider.quotient:
      Ok(value): "result: {value}"
      Err(DivideError::ByZero): "result: undefined"
```

The divide-by-zero case never traps; it produces `Err(...)` through
the type system, which `Consumer.report` handles via `match`. No
kernel-level error isolation is needed.

This applies uniformly across the language. Traps are for bugs that
should abort; value-track errors are for conditions the program
must handle. The reactive context is no exception.

#### 14.6.4 Behavior identity

Each behavior is identified by a stable u32 ID assigned at compile
time. IDs are **content-addressed**: a stable hash of the canonicalized
typed IR of the behavior body. "Canonicalized" means the IR is
normalized (alpha-renamed locals, sorted decl order where order is
irrelevant, position information stripped) before hashing, so
cosmetic changes — adding whitespace, reordering independent
declarations, renaming local bindings — do not perturb the ID.
Semantic changes — different operations, different inputs, different
output type — produce different IDs.

The hash algorithm is fixed per Symphony toolchain version (§14.12)
so that hot reload (§14.11) within one version reliably matches
unchanged behaviors across recompilations. Across major toolchain
versions the canonicalization may change; cross-version hot reload
is not supported.

Each behavior also carries a debug name: the qualified source path
(`module::path::clip_name::derived_name`). Names appear in
diagnostics, profiles, and error messages. Lookup is by ID; names are
for human consumption.

#### 14.6.5 Thread invocation

Behaviors are invoked by the kernel; the specific thread that
invokes each behavior is determined by the role assignment
specified in §13 (reactive system). Symphony source does not
specify thread roles.

Symphony source code does not encounter cross-thread concerns:
behaviors are thread-safe by construction (no shared mutable state
outside reactive cells, which are coordinated by the kernel per
§14.3.3).

### 14.7 Graph Metadata

The compiler produces, alongside the executable behaviors, a binary
**graph metadata** structure describing the program's reactive shape.

#### 14.7.1 Contents

The metadata describes:

- **Cell layout**: position (cell index) and primitive type tag for
  each reactive cell. Used by the kernel to allocate the buffer and
  by the host API to read/write cells.

- **Signal declarations**: name, cell index, type tag, initial value.
  Used to register signals at startup.

- **Node types**: type name, list of attrs and deriveds, layout of
  their cells per instance. Used to allocate per-instance cell groups.

- **Connection types**: source/destination types, attrs and deriveds.
  Same as nodes.

- **Instances**: declared node/connection instances and their cell
  allocations.

- **Dependency edges**: which behaviors read which cells, which
  behaviors write which cells. Used to compute dirty-set propagation
  and topological evaluation order.

- **Behavior references**: behavior IDs paired with debug names. The
  kernel resolves IDs to function pointers via the behavior table
  registered at program startup.

- **String pool entries**: any string literals used by the program,
  pre-loaded into the pool at startup.

#### 14.7.2 Format

The graph metadata is a binary format. The reference implementation
uses a schema-based serialization (e.g., FlatBuffers, Cap'n Proto, or
a custom binary format). The exact byte layout is implementation-
defined; the schema content (the fields and types listed above) is
normative.

In native mode (§14.1.3), the graph metadata is embedded in the
output executable as a binary blob (e.g., via Rust's `include_bytes!`
or the linker's data sections). At program startup, the kernel
deserializes the embedded blob and constructs the runtime graph.

In interpreter mode (§14.1.2), the metadata is held in memory by the
running kernel and may be updated by hot reload.

#### 14.7.3 What metadata does not contain

The metadata is intentionally type-erased at the kernel boundary. It
contains primitive type tags (i32, f64, string, etc.) and cell
layouts, but **not** Symphony's full type system (record definitions,
trait conformances, generic parameters). Those are compile-time
artifacts of Symphony, not runtime artifacts the kernel consumes.

The kernel's view of the program is: a graph of cells with primitive
types, dependency edges, and behavior references. The kernel does
not need to understand records as records, or traits as traits — it
manages bits in cells and invokes functions by ID.

### 14.8 Producer and Consumer Roles

The triple-buffer mechanism (§14.3.3) operates in terms of two roles:

- **Producer**: the role that writes the back buffer, runs tick
  cycles, and performs the publish operation. There is exactly one
  producer per kernel instance (SPSC). The producer may also read
  the back buffer it is writing; such reads are local to the
  producer and do not go through the triple-buffer pointer swap.
  What the producer writes (signal/attr/state updates from host
  API, derived and `next:` expression results, etc.) and what
  triggers it to tick and publish are specified in §13.
- **Consumer**: the role that reads the current buffer via the swap
  operation. Loads the current pointer and reads cells from the
  buffer it points to. Never writes; never invokes behaviors. There
  is one consumer per SPSC channel; if multiple cross-thread
  observers are needed, each maintains its own SPSC channel
  (§14.3.3.4).

§14 specifies only the mechanism of these roles — what each role is
permitted to do, how the two coordinate via the triple buffer, and
the costs of the swap and publish operations. The mapping of roles
to physical threads, the choreography of what the producer does
between publishes, and the trigger that initiates a publish are all
specified in §13 (reactive system).

#### 14.8.1 Thread-safety properties of the mechanism

By construction of the SPSC triple buffer:
- The producer writes the back buffer without interference; the
  consumer never touches it.
- The consumer reads the current buffer without interference; the
  producer never touches it.
- The atomic current-pointer swap is the synchronization point
  between producer and consumer.
- No locks are required, no spin-wait is required, and reads are
  wait-free.

These properties hold regardless of the role-to-thread mapping
specified in §13.

#### 14.8.2 Behaviors invoked by the mechanism

Reactive behaviors (derived expression bodies, state-cell `next:`
expressions, functions called from reactive contexts) are invoked
by the producer. The trigger, the selection of which behaviors are
invoked, and the ordering of invocations within a tick cycle are
all specified in §13.

The behavior ABI (§14.6) is the contract between the producer and
each invoked behavior. Each invocation receives a kernel handle
and an instance ID; behavior bodies read from and write to cells
via the handle. Behaviors are thread-safe by construction
(§14.8.3).

#### 14.8.3 Why Symphony behaviors are thread-safe by construction

Regardless of the role-to-thread mapping in §13, Symphony source
code never sees cross-thread concerns:

- No shared mutable state outside reactive cells.
- Reactive cells are coordinated through the triple-buffer
  mechanism above.
- Local `mut` bindings (§11) are stack-allocated and per-invocation.
- Closure captures are by-value Copy (§11.10), no shared mutability.

A Symphony program does not declare thread affinity; it does not
need to. The kernel determines (per §13) which thread plays which
role.

### 14.9 Drop Semantics

Symphony's user-facing `Drop` trait (referenced as deferred in §11.3.3
and §12.9.3) is specified here.

#### 14.9.1 The Drop trait

```
trait Drop:
  fn drop(value: mut Self)
```

A type implementing `Drop` provides cleanup logic that runs when a
value of the type goes out of scope. The `drop` method receives the
value by `mut` (the only place in the language where a `mut`
parameter is permitted — internally generated by the compiler at the
scope-exit point).

#### 14.9.2 When drop runs

The compiler inserts drop calls at:

- The end of a value's lexical scope (when its `let` or `mut` binding
  goes out of scope).
- The point of consumption (when a value is moved into a function
  parameter or assignment; the moved-out source's drop slot is empty
  thereafter).
- The end of a function for un-returned locals.
- The point of `break` for non-yielded iterator elements (§12.9.3).

Compound values (records, enums) drop in **reverse declaration
order** of their fields: the last-declared field drops first.

#### 14.9.3 Partial moves

If only some fields of a record have been moved out when the binding
goes out of scope, only the un-moved fields drop. The compiler tracks
per-binding move flags during semantic analysis.

#### 14.9.4 Drop and panic

If a `drop` method panics, the process aborts (the standard trap
behavior per §4.6.1). This prevents double-drop hazards from
mid-drop panics that would otherwise leave the program in an
inconsistent state.

#### 14.9.5 Drop on reactive cells

The kernel manages drop for reactive cells. When a node or connection
instance is removed (deferred to §13's evolution model), its attr and
derived cells are dropped per their type's `Drop` impl. Initial
declarations (signals declared at program startup) live for the
program's lifetime; their cells are dropped at program shutdown.

### 14.10 Symphony → Rust Lowering

The Rust emitter (§14.1.3) lowers the typed IR to Rust source per
the following rules.

#### 14.10.1 Type lowering

| Symphony | Rust |
|---|---|
| `i8`–`i64`, `u8`–`u64` | Same Rust types. |
| `i128`, `u128` | Same Rust types (on supporting targets). |
| `f32`, `f64` | Same Rust types. |
| `bool`, `char` | `bool`, `char`. |
| `string` | A newtype wrapping a kernel string handle (see §14.10.1.1). |
| Tuples | Rust tuples. |
| Arrays `T[N]` | Rust arrays `[T; N]`. |
| Records | Rust structs with same field order. |
| Enums | Rust enums with same variant order. |
| Newtypes (§6.3) | Rust newtype structs. |

##### 14.10.1.1 String storage uniformity

The `string` type lowers to the same Rust representation regardless
of whether the binding is reactive or non-reactive: a newtype around
a u64 handle into the kernel's string pool (§14.5).

Reactive context (signal/attr/derived value of type `string`): the
handle lives in a reactive cell. The pool entry's refcount tracks
how many cells reference the string across all buffer copies.

Non-reactive context (local `let s = "hello"`, function parameter,
record field outside reactive declaration): the handle lives in
ordinary Rust memory. The pool entry is still refcounted; ownership
of the handle increments the refcount, dropping the handle (per
§14.9) decrements it. Strings created in non-reactive scopes are
reclaimed when their last handle is dropped — typically when the
function returns and locals go out of scope.

This uniformity means: all `string` values share one storage backend
(the kernel pool), regardless of where their handles are held. There
is no separate "Rust-local string" representation distinct from the
"kernel string" representation; the only difference is *where the
handle is stored* (cell vs ordinary memory), not what the handle
points to.

The §11.6 "refcount-shared immutable backing" model maps directly
onto the kernel pool. The pool *is* the shared backing.

#### 14.10.2 Function and trait lowering

Symphony resolves all generic instantiations and trait dispatch
during frontend processing (§14.1.1). Emitted Rust is fully
monomorphic and trait-free:

- A generic Symphony function `fn f[T](...)` becomes multiple
  monomorphic Rust functions, one per instantiation: `f_i32`,
  `f_f64`, etc.
- Trait method calls dispatch in Symphony to a specific function;
  the emitted Rust call is direct, not through a trait.
- Symphony traits are not declared in the emitted Rust. No `trait`
  or `impl` blocks appear (with the exception below).
- Operator overloading on Symphony numeric primitives uses Rust's
  built-in operators (`+`, `-`, etc.) directly; no trait emission
  needed.

The one exception: when a Symphony record overloads a Symphony
operator (e.g., a user-defined `Vec3` with `Add`), the emitter
generates an explicit `impl std::ops::Add for Vec3` block in Rust so
that `+` works on the type at the Rust level. This is a narrow
mechanical emission, not a full trait export.

#### 14.10.3 Ownership lowering

Symphony's ownership rules map directly to Rust's:

| Symphony | Rust |
|---|---|
| `let x = e` | `let x = e;` |
| `mut x = e` | `let mut x = e;` |
| Pass by value (move) | Pass by value (move). |
| `&T` parameter (borrow) | `&T` parameter. |
| `for x in v:` (consume) | `for x in v` (consumes). |
| `for x in &v:` (borrow) | `for x in &v` (borrows). |
| `Copy` types | `Copy` trait derived. |
| `Clone` | `Clone` trait derived. |

Symphony's `&v` form in for-loops compiles to Rust's `&v`. Symphony's
parameter borrow `&T` compiles to Rust's `&T`. Rust's borrow checker
enforces the same rules that Symphony's frontend already verified;
any code that passed Symphony's checks passes Rust's.

#### 14.10.4 Iterator lowering

Symphony's `Iterator` trait (§12.7) has signature `fn next(iter:
Self) -> (Option[Item], Self)`. Rust's standard `Iterator` trait has
signature `fn next(&mut self) -> Option<Item>`.

The Symphony emitter generates Rust code using Rust's `Iterator`
pattern internally for performance, while Symphony source code
continues to see the tuple-return form. The translation is
mechanical: each Symphony iterator implementation lowers to a Rust
struct with a `next(&mut self) -> Option<Item>` method, plus a
wrapper that exposes the tuple-return form for Symphony-internal
use during compilation. By the time native code is produced, only
the `&mut self` form remains.

This translation is invisible to Symphony source code. Symphony users
never see `&mut` in their code or in error messages.

#### 14.10.5 Reactive primitive lowering

Symphony's `signal`, `attr`, `derived` declarations do not lower to
Rust types directly. They lower to:

- Cell allocations in the kernel state buffer (described in graph
  metadata).
- Behavior registrations (the body of a `derived` expression becomes
  a Rust function matching the behavior ABI, §14.6).
- Dependency edges in the graph metadata.

The lowered Rust code contains no syntactic trace of `signal`/`attr`/
`derived` keywords. They are pure graph-construction directives,
encoded into the metadata and behavior table.

### 14.11 Hot Reload

Interpreter mode (§14.1.2) supports hot reload of individual
behaviors in a running kernel.

#### 14.11.1 Granularity

The unit of hot reload is the **behavior**. When a Symphony source
file changes:

1. The CLI's watch mode detects the change.
2. The frontend re-runs on the changed file.
3. The new typed IR is compared against the old; behaviors with
   changed bodies are identified.
4. For each changed behavior:
   a. The old bytecode is replaced with new bytecode.
   b. The kernel's behavior table updates the function pointer (or
      bytecode reference) for that behavior's ID.
   c. The next invocation uses the new behavior.

#### 14.11.2 State preservation

Reactive cell values persist across hot reload. Signal values, attr
values, and derived cached values are unchanged unless the source
explicitly changes them. The graph topology persists.

#### 14.11.3 Reload-safe and reload-unsafe changes

Changes safe to hot reload:
- Body of an existing behavior (same signature, different
  implementation).
- Adding new behaviors (new derived expressions, new functions).
- Adding new signals, attrs, derived declarations.

Changes unsafe to hot reload (require full kernel restart):
- Removing a signal/attr/derived that is currently referenced.
- Changing the type of an existing cell.
- Changing the connection topology of currently-active instances.

The implementation diagnoses unsafe changes at reload time and
either rejects them (kernel keeps running old version) or restarts
the kernel cleanly. The choice is implementation-defined.

#### 14.11.4 Reload failure

If the new source fails to compile (parse error, type error,
ownership error), the reload is abandoned. The kernel keeps running
the previous version. The CLI surfaces the compilation error to the
user.

Hot reload never produces a kernel in an inconsistent state. Either
the old version continues running, or the new version is fully
applied, never a mix.

### 14.12 Versioning

Symphony's source format, graph metadata format, behavior ABI, and
kernel build are versioned together. Each Symphony release is a
matched set:

- Symphony source format version.
- Graph metadata schema version.
- Behavior ABI version.
- Kernel binary version.

Cross-version mixing is not supported. A Symphony program produced
by version X.Y compiles with and runs against the same X.Y
toolchain. Forward and backward compatibility across major version
boundaries are explicit, not implicit.

The version is recorded in source files via `@version` directives
(syntactic form: implementation-defined) and in the graph metadata
header. Mismatches are detected at compile time and load time
respectively.

---

*End of §14.*