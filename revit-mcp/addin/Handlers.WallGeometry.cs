using System;
using System.Linq;
using System.Text.Json.Nodes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;

namespace RevitMcp
{
    internal static partial class Handlers
    {
        private static JsonNode SetWallAxis(UIApplication app, JsonObject p)
        {
            var doc = SurfaceDocumentP04(app, p);
            var wall = RequireElement(doc, ReqId(p, "element_id")) as Wall
                ?? throw new ArgumentException("element_id must be a wall.");
            var location = wall.Location as LocationCurve;
            if (wall.Pinned || !(location?.Curve is Line oldLine))
                throw new ArgumentException("Only an unpinned straight wall is supported.");
            var start = ReqPoint(p, "start"); var end = ReqPoint(p, "end");
            if (!new[] { start.X, start.Y, start.Z, end.X, end.Y, end.Z }.All(double.IsFinite) ||
                start.DistanceTo(end) <= app.Application.ShortCurveTolerance ||
                Math.Abs(start.Z - oldLine.GetEndPoint(0).Z) > FromMm(0.01) ||
                Math.Abs(end.Z - oldLine.GetEndPoint(1).Z) > FromMm(0.01))
                throw new ArgumentException("A finite nondegenerate axis at the original elevation is required.");
            var guards = (p["preserve_wall_ids"] as JsonArray ?? new JsonArray()).Select(n =>
            {
                var other = RequireElement(doc, new ElementId(n.GetValue<long>())) as Wall
                    ?? throw new ArgumentException("Every preserve_wall_id must be a wall.");
                if (other.Id == wall.Id || !(other.Location is LocationCurve lc) || !(lc.Curve is Line))
                    throw new ArgumentException("Preserved walls must be other straight walls.");
                return (Wall: other, Start: lc.Curve.GetEndPoint(0), End: lc.Curve.GetEndPoint(1));
            }).ToList();
            var oldType = wall.GetTypeId(); var oldLevel = wall.LevelId;
            var oldCreated = wall.CreatedPhaseId; var oldDemolished = wall.DemolishedPhaseId;
            return InTransaction(doc, "Set wall axis with adjacent-wall guards", () =>
            {
                var allow0 = WallUtils.IsWallJoinAllowedAtEnd(wall, 0);
                var allow1 = WallUtils.IsWallJoinAllowedAtEnd(wall, 1);
                WallUtils.DisallowWallJoinAtEnd(wall, 0);
                WallUtils.DisallowWallJoinAtEnd(wall, 1);
                location.Curve = Line.CreateBound(start, end);
                if (allow0) WallUtils.AllowWallJoinAtEnd(wall, 0);
                if (allow1) WallUtils.AllowWallJoinAtEnd(wall, 1);
                doc.Regenerate();
                foreach (var g in guards)
                {
                    var lc = (LocationCurve)g.Wall.Location;
                    if (lc.Curve.GetEndPoint(0).DistanceTo(g.Start) > FromMm(0.1) ||
                        lc.Curve.GetEndPoint(1).DistanceTo(g.End) > FromMm(0.1))
                        throw new InvalidOperationException($"Adjacent wall {g.Wall.Id.Value} moved; change rolled back.");
                }
                if (wall.GetTypeId() != oldType || wall.LevelId != oldLevel || wall.CreatedPhaseId != oldCreated || wall.DemolishedPhaseId != oldDemolished)
                    throw new InvalidOperationException("Wall type, level or phases changed; change rolled back.");
                return new JsonObject { ["id"] = wall.Id.Value, ["start"] = PointJson(location.Curve.GetEndPoint(0)),
                    ["end"] = PointJson(location.Curve.GetEndPoint(1)), ["length_mm"] = ToMm(location.Curve.Length),
                    ["preserved_adjacent_walls"] = guards.Count, ["type_level_phases_preserved"] = true };
            });
        }
    }
}
