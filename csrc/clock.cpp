// Box2D reads the clock around every stage of a step (src/solver.c, src/physics_world.c, src/island.c), and in WebAssembly
// each read crosses into JavaScript. This build links with --wrap=clock_gettime (scripts/build.sh), so the clock reads
// zero until asked for. Without the timers b2World_GetProfile is all zeros; results do not depend on them. The one loop
// with a time limit, b2SchedulerSpin, runs only on worker threads, and this build has none.
#include <emscripten/bind.h>
#include <time.h>

static bool s_stepTimers = false;

extern "C" int __real_clock_gettime( clockid_t id, struct timespec* ts );
extern "C" int __wrap_clock_gettime( clockid_t id, struct timespec* ts )
{
	if ( s_stepTimers )
	{
		return __real_clock_gettime( id, ts );
	}
	ts->tv_sec = 0;
	ts->tv_nsec = 0;
	return 0;
}

static void enableStepTimers( bool on )
{
	s_stepTimers = on;
}

EMSCRIPTEN_BINDINGS( efa_clock )
{
	emscripten::function( "enableStepTimers", &enableStepTimers );
}
