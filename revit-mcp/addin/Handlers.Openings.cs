using System;
using System.Linq;
using System.Text.Json.Nodes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;

namespace RevitMcp
{
    internal static partial class Handlers
    {
        private static XYZ PilotPoint(JsonObject p, string key)
        {
            var node = p[key] as JsonObject ?? throw new ArgumentException($"{key} must be an object with x, y and optional z in millimetres.");
            var x = ReqNum(node, "x");
            var y = ReqNum(node, "y");
            var z = Num(node, "z") ?? 0;
            if (!double.IsFinite(x) || !double.IsFinite(y) || !double.IsFinite(z))
                throw new ArgumentException($"{key} coordinates must be finite millimetres.");
            return new XYZ(FromMm(x), FromMm(y), FromMm(z));
        }

        /// <summary>
        /// Cut a rectangular opening in a straight wall. The two corners are opposite
        /// corners of the opening, both on the wall's own plane, in model millimetres.
        /// The host wall is not split and keeps its identity, so the opening can later
        /// host a door or a window family.
        /// </summary>
        private static JsonNode CreateOpening(UIApplication app, JsonObject p)
        {
            var doc = RequireNativePilotDocument(app, p);
            var wall = RequireElement(doc, ReqId(p, "wall_id")) as Wall
                ?? throw new ArgumentException("wall_id must be a wall in the target document.");
            if (wall.WallType != null && wall.WallType.Kind == WallKind.Curtain)
                throw new ArgumentException("Curtain walls cannot take a rectangular opening with this command; use the curtain grid tools.");

            var wallLine = (wall.Location as LocationCurve)?.Curve as Line;
            if (wallLine == null)
                throw new ArgumentException("wall_id must be a straight wall with a linear location curve.");

            var a = PilotPoint(p, "corner_a");
            var b = PilotPoint(p, "corner_b");

            if (a.DistanceTo(b) <= Math.Max(FromMm(2.54), app.Application.ShortCurveTolerance))
                throw new ArgumentException("The two corners are too close to define an opening.");

            var comments = Str(p, "comments");

            var wallDir = (wallLine.GetEndPoint(1) - wallLine.GetEndPoint(0)).Normalize();
            var normal = new XYZ(-wallDir.Y, wallDir.X, 0).Normalize();
            var wallOrigin = wallLine.GetEndPoint(0);
            var offsetA = (a - wallOrigin).DotProduct(normal);
            var offsetB = (b - wallOrigin).DotProduct(normal);
            if (Math.Abs(offsetA - offsetB) > FromMm(1.0))
                throw new ArgumentException("corner_a and corner_b must lie on the wall plane; they are offset from it by different amounts.");

            return InTransaction(doc, "Create wall opening", () =>
            {
                var opening = doc.Create.NewOpening(wall, a, b);
                doc.Regenerate();
                if (opening == null)
                    throw new InvalidOperationException("Revit refused to create the opening - check that the rectangle lies fully inside the wall.");

                var bb = opening.get_BoundingBox(null);
                var widthMm = Math.Abs(ToMm(b.X - a.X)) + Math.Abs(ToMm(b.Y - a.Y));
                var heightMm = Math.Abs(ToMm(b.Z - a.Z));

                if (comments != null)
                    opening.get_Parameter(BuiltInParameter.ALL_MODEL_INSTANCE_COMMENTS)?.Set(comments);

                return new JsonObject
                {
                    ["id"] = opening.Id.Value,
                    ["native_class"] = opening.GetType().FullName,
                    ["document"] = doc.PathName,
                    ["host_wall_id"] = wall.Id.Value,
                    ["width_mm"] = Math.Round(widthMm, 1),
                    ["height_mm"] = Math.Round(heightMm, 1),
                    ["corner_a_mm"] = new JsonArray(ToMm(a.X), ToMm(a.Y), ToMm(a.Z)),
                    ["corner_b_mm"] = new JsonArray(ToMm(b.X), ToMm(b.Y), ToMm(b.Z)),
                    ["host_bound_unchanged"] = true,
                    ["note"] = "Rectangular opening in the host wall; the wall identity is preserved so a door or window family can host in it later.",
                };
            });
        }
    }
}
