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

**Immutability by default and only.** All bindings (`let`, signal declarations,
function parameters) are immutable. There is no `mut` or `var`. Change over
time is expressed through the reactive system, not through assignment.

**Pure functions.** All user-defined functions are pure: same inputs produce
same outputs, no side effects. The reactive system provides the controlled
mechanism for time-varying behavior; ordinary computation is pure.

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
                       //   per the lossless-widening rule (§ — Numeric System)
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
unsigned integers is a type error — see §4.3). The runtime unary-minus
operator's rules still apply to runtime values; only literal parsing is
special.

#### 2.4.6 Reactivity provenance in diagnostics

The compiler tracks reactivity provenance through expressions. When an
expression's value is reactive, the compiler can identify the signal(s) it
depends on. This information appears in error messages when reactivity
prevents an expression from being compile-time evaluable:

```
let x: u8 = compute(mouse_position)
// error: value of `x` is reactive (depends on signal `mouse_position`
// at line 14); cannot fit-check against `u8` at compile time
```

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

trait Iterable:
  type Item
  fn next(value: Self) -> Option[Item]
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
trait Iterable:
  type Item
  fn next(it: Self) -> Option[Item]
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
`.` member-access notation (§ — Generic Parameters):

```
fn sum[I: Iterable](it: I) -> I.Item where I.Item: Numeric:
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

The `requires` mechanism is how trait hierarchies are constructed (§3.6).

#### 3.1.5 Trait-level default concrete type

A trait may declare a default concrete type used by the defaulting mechanism
(§ — Numeric System, defaulting rules). When a use site is constrained solely
by a trait (or traits) with declared defaults and nothing else pins the type,
the trait's default fires.

The default must itself satisfy the trait; this is compiler-enforced.

```
@default(i32)
trait Integer:
  requires Numeric, Rem, IntDiv, BitAnd, BitOr, BitXor, BitNot, Shl, Shr
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
incomparable defaults conflict per §3.5.2, or the user wants a non-default
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

Type parameters on a trait are part of the trait's identity. `From[i32]` and
`From[i64]` are distinct trait instances; a type may implement both. Default
type parameters (`Rhs = Self`) follow the rules in § — Generic Parameters.

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

A type's `satisfies` set must not contain two traits whose method names
overlap. If `Trait1` and `Trait2` each declare a method named `display`, no
type can declare `satisfies Trait1, Trait2` — the compiler rejects the
declaration with an error identifying the conflicting method name and the
two traits.

This rule preserves the contract semantics of `satisfies`. A reader of a
type's declaration sees the full set of contracts the type promises; if those
contracts had hidden naming conflicts, the contract sheet would be lying
about what `display` (or whichever method) does. By forbidding overlap at the
declaration site, the contract remains unambiguous: every method name on the
type maps to exactly one trait-method origin.

##### Algorithm: effective method-set computation

Given a type `T` with `satisfies T1, T2, ..., Tn`, the compiler computes
`T`'s *effective method set* and checks for collisions:

1. Initialize the effective set as empty.
2. For each directly-satisfied trait `Ti`, compute the closure of `Ti` under
   the `requires` relation: `Ti` itself plus every trait reachable through
   any chain of `requires` clauses.
3. Union the method declarations of all traits in the closure for all `Ti`s
   into the effective set. Each entry is a (method-name, declaring-trait)
   pair.
4. If two entries share the same method name but originate from different
   trait-method declarations (i.e., distinct (declaring-trait, method-name)
   pairs collide on the name alone), the declaration is rejected. The error
   identifies the conflicting name and the two source traits.
5. Methods reached through multiple `requires` paths but originating from
   the *same* trait-method declaration are not in conflict — they are the
   same method, just reachable via multiple inheritance paths. This is the
   "diamond" case (Topic 9's note on diamond inheritance being well-defined
   in nominal trait systems) and is permitted.

The §3.1.4 rule (traits cannot redeclare methods from required traits)
guarantees that step 5's "same trait-method declaration reached multiple
ways" case has a single origin: the original declaring trait. There is no
ambiguity about which method is which when diamonds occur.

##### Workaround for legitimate dual conformance

When two traits a user wants both have conflicting method names, the
canonical workaround is the newtype pattern: define separate newtype wrappers
of the underlying type, each satisfying one of the conflicting traits.
Distinct newtypes have distinct contract sheets and distinct method
dispatches.

##### Consequence for dispatch

The rule simplifies dispatch (§3.4): because no type can satisfy two traits
with overlapping method names, the case of "multiple trait impls match this
call site" cannot arise. Call-site name resolution always finds at most one
trait-impl candidate for a given (type, method-name) pair.

### 3.3 Implementation Blocks (`fulfill`)

A `fulfill` block delivers a trait's implementation for a specific type:

```
fulfill Display for Person:
  fn display(value: Person) -> string:
    "{value.first_name} {value.last_name}"
```

The block lives in some module (subject to the orphan rule from §3.6), not
necessarily in the same module as either the trait or the type. Multiple
`fulfill` blocks for the same (trait, type) pair are rejected by the coherence
rule (§3.6): exactly one implementation exists per pair, reachable through
the module graph.

Functions defined inside a `fulfill Trait for Type` block live in a
*(Trait, Type)-scoped namespace*, not in the enclosing module's free-function
namespace. This is the key distinction from ordinary top-level function
definitions:

- A free function `fn display(p: Person)` defined at module level occupies a
  name slot in that module's free-function namespace. Per § — Visibility and
  Modules, function names are unique within their module; defining two free
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

The trait-path form (`Trait::method`) is always available regardless of
imports. Per §3.2.1 the bare-name forms are never ambiguous between traits
(a type cannot satisfy two traits with overlapping method names), so the
trait-path form is not needed for disambiguation — it remains available for
stylistic clarity when a user wants the call's trait source visible at the
call site. The other forms rely on name resolution per § — Visibility and
Modules.

#### 3.4.1 Resolution across free-function and trait-implementation namespaces

A bare-name call `f(x)`, method-call `x.f()`, or pipe-forward `x >> f` may
resolve to either a trait-implementation function or a free function. The
resolution algorithm prioritizes trait implementations over free functions:

1. **Trait-impl search.** For each trait `T` reachable in the current scope
   (imported or accessible by path) such that `x`'s type fulfills `T` and `T`
   declares a method named `f`, collect the trait-impl candidate
   `T::f(x, ...)`. The function bodies live inside the corresponding `fulfill
   T for X` blocks.
2. **At most one trait-impl candidate can match.** Per §3.2.1, no type may
   satisfy two traits with overlapping method names — the type's `satisfies`
   declaration would have been rejected. Therefore the trait-impl search
   yields either zero or one candidate; never more.
3. **One trait-impl candidate matches → resolve to it.** The trait impl wins.
   A free function with the same name in scope is *shadowed* at this call
   site; it remains callable only via path qualification (e.g.,
   `some_module::f(x, ...)`).
4. **No trait-impl candidate matches → fall back to free-function search.**
   The compiler looks in the current scope's free-function namespace for a
   function `f` whose first parameter type matches `x`'s type (or is reachable
   via implicit widening per § — Numeric System).
5. **One free function matches → resolve to it.** Standard free-function
   dispatch.
6. **Multiple free functions in scope under the same local name is
   impossible.** Free functions are uniquely named within their module per
   § — Visibility and Modules (Option E); only one can be in scope under any
   given local name. Cross-module conflicts are resolved at import time, not
   at call time.
7. **Nothing matches → unknown method error.** The diagnostic includes the
   receiver's type, the unmatched name, and any near-matches the compiler
   identified.

The algorithm is deterministic and never produces call-site ambiguity for
trait method calls: the §3.2.1 rule guarantees that any given (type, method-
name) pair has at most one trait-impl source, and the §10 module rules
guarantee that any given module-scope name has at most one free-function
source. Trait-path syntax (`Trait::f(x)`) remains available as the explicit
form for cases where a user wants to make the call's trait source visible at
the call site for clarity, even when bare-name resolution would succeed
unambiguously.



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
§2.3.5; coherence (§3.6) guarantees there is exactly one implementation to
dispatch to within a (trait, type) pair. The free-function vs trait-impl
namespace distinction is purely for *name resolution at call sites* — once
resolved, the call compiles to a direct function call to a specific function
identified by its fully-qualified path (module-path-or-trait-path + name).

### 3.5 Trait Hierarchies

Traits compose into hierarchies via `requires` clauses. The recommended
pattern, used pervasively in the language's standard library, is *fine-grained
operator/capability traits combined into umbrella traits*.

#### 3.5.1 The fine-grained-plus-umbrella pattern

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
introducing no new methods:

```
@default(i32)
trait Numeric:
  requires Add, Sub, Mul, Neg, Zero, One

@default(i32)
trait Integer:
  requires Numeric, Rem, IntDiv, BitAnd, BitOr, BitXor, BitNot, Shl, Shr

@default(f64)
trait Float:
  requires Numeric, Div, ...

@default(i32)
trait Signed:
  requires Integer, Neg

@default(u32)
trait Unsigned:
  requires Integer  // not Neg
```

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

#### 3.5.2 Default trait selection in defaulting

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

### 3.6 Coherence and Orphan Rules

Coherence is the property that for every (trait, type) pair, exactly one
implementation exists, reachable through the module graph. The language
enforces coherence structurally via the orphan rule.

#### 3.6.1 The strict orphan rule

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

#### 3.6.2 Generic-parameter coverage

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

#### 3.6.3 Language-privileged implementations

Certain implementations are provided by the language itself rather than by
user modules, and are not subject to the orphan rule:

- *Auto-implementations of built-in numeric traits for built-in numeric
  types.* The fine-grained operator traits (`Add`, `Sub`, `Mul`, etc.) are
  pre-implemented for the built-in numeric types. User code cannot redefine
  these.
- *Auto-derivations from `From` to `Into` and `TryFrom` to `TryInto`* (§ —
  Conversion System). When a user writes `fulfill From[T] for U`, the
  language automatically provides `Into[U] for T`. The derivation is built
  in, not user-writable.
- *Identity conversion `From[T] for T` for every type.* Universally provided.

These privileged implementations exist outside the user-writable
`fulfill`-block space and cannot conflict with user code.

#### 3.6.4 Newtype pattern as orphan-rule workaround

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
Newtype semantics are specified in § — Newtypes.

### 3.7 Automatic Derivation (`@derive`)

For a fixed set of common traits, the language provides automatic structural
derivation via the `@derive` annotation (grammar §3.3). Applying `@derive` to
a type generates the appropriate `fulfill` blocks structurally, saving the
user from writing mechanical implementations.

#### 3.7.1 Derivable traits

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

#### 3.7.2 Structural derivation rules

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

For a newtype (§ — Newtypes), `@derive` may delegate to the underlying type
or operate structurally over fields, depending on the newtype's shape; see
the newtype section for details.

Derivation requires every field's (or payload's) type to itself satisfy the
trait being derived. `@derive(Eq)` on `type Foo: x: SomeType` requires
`SomeType: Eq`. If any component type does not satisfy the trait, derivation
fails with a compile error identifying the offending component.

#### 3.7.3 Overriding derived implementations

A type may both `@derive` a trait and provide a manual `fulfill` block for
the same trait. The manual `fulfill` block takes precedence; the derived
implementation is suppressed for that (trait, type) pair.

This allows users to start with derived defaults and override specific
implementations as needed without removing the `@derive` annotation.

---

*End of §3. Subsequent sections (§4 Numeric System, §5 Type Intersection and
dyn, §6 Records and Enums, §7 Conversion System, §8 Error Handling, §9
Strings and Tuples, §10 Visibility and Modules) follow.*