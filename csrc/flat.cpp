// One call for every moved body's pose and velocities, instead of an embind object and several calls per body. The
// records are 32-bit words in the module's memory, at flatOut(): 8 a body, the body's index and generation as integers,
// then x, y, angle, vx, vy, w as floats. They are valid until the next readMoved; memory can grow during any call, so JS
// takes HEAPU32 and HEAPF32 after it.
#include <box2d/box2d.h>
#include <box2d/math_functions.h>
#include <emscripten/bind.h>
#include <stdint.h>
#include <vector>

union FlatWord
{
	float f;
	uint32_t u;
};

static std::vector<FlatWord> g_flatOut( 8 );

static int flatOut()
{
	return (int)(uintptr_t)g_flatOut.data();
}

static int readMoved( b2WorldId world )
{
	b2BodyEvents events = b2World_GetBodyEvents( world );
	if ( (size_t)events.moveCount * 8 > g_flatOut.size() )
	{
		g_flatOut.resize( (size_t)events.moveCount * 8 );
	}
	FlatWord* out = g_flatOut.data();
	int written = 0;
	for ( int i = 0; i < events.moveCount; ++i )
	{
		const b2BodyMoveEvent& e = events.moveEvents[i];
		// Its velocities come from the body: one destroyed after the step has none to give.
		if ( !b2Body_IsValid( e.bodyId ) )
		{
			continue;
		}
		b2Vec2 v = b2Body_GetLinearVelocity( e.bodyId );
		out[0].u = (uint32_t)e.bodyId.index1;
		out[1].u = e.bodyId.generation;
		out[2].f = e.transform.p.x;
		out[3].f = e.transform.p.y;
		out[4].f = b2Rot_GetAngle( e.transform.q );
		out[5].f = v.x;
		out[6].f = v.y;
		out[7].f = b2Body_GetAngularVelocity( e.bodyId );
		out += 8;
		++written;
	}
	return written;
}

EMSCRIPTEN_BINDINGS( efa_flat )
{
	emscripten::function( "flatOut", &flatOut );
	emscripten::function( "readMoved", &readMoved );
}
