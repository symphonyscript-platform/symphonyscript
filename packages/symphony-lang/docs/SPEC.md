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

A function with omitted parameter types is generic. The omitted types become
fresh, unique generic parameters with inferred constraints. The implicit form
desugars to the explicit form:

```
fn lerp(a, b, c): a + (b - a) * c
// equivalent to:
fn lerp[T](a: T, b: T, c: T) where T: Numeric:
  a + (b - a) * c
```

(The exact synthesized parameters and inferred bounds depend on the body's
operations; the example shows the common case where all three parameters
unify.)

The two forms produce the same code and the same semantics. The choice is
stylistic. Mixed forms are permitted: some parameter types explicit, others
omitted.

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
not annotate it.

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

*End of §2. Subsequent sections (§3 Trait System, §4 Numeric System, §5 Type
Intersection and dyn, §6 Records and Enums, §7 Conversion System, §8 Error
Handling, §9 Strings and Tuples, §10 Visibility and Modules) follow.*
